import { createHash } from "node:crypto";
import { access, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const archiveRoot = path.join(
	projectRoot,
	"generated-art",
	"artoria-cinematic-v2",
);
const generatedDir = path.join(archiveRoot, "generated");
const publicDir = path.join(
	projectRoot,
	"public",
	"assets",
	"images",
	"home",
	"artoria-scroll-4k",
);
const contactSheetPath = path.join(
	archiveRoot,
	"contacts",
	"artoria-24-final-contact-sheet.png",
);
const archiveManifest = JSON.parse(
	await readFile(path.join(archiveRoot, "manifest.json"), "utf8"),
);
const completedFrames = archiveManifest.frames.map((item) => ({
	frame: item.frame,
	sourceTime: item.sourceTime,
	taskId: item.taskId,
}));

if (
	completedFrames.length !== 24 ||
	completedFrames.some(
		(item) => !/^\d{2}$/.test(item.frame) || !Number.isInteger(item.taskId),
	)
) {
	throw new Error(
		"Archive manifest must contain 24 traceable generated frames.",
	);
}

async function exists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

const finalized = [];
for (const item of completedFrames) {
	const downloaded = path.join(
		generatedDir,
		`workbench-task-${item.taskId}-0.png`,
	);
	const archived = path.join(
		generatedDir,
		`frame-${item.frame}-task-${item.taskId}.png`,
	);
	if (await exists(downloaded)) {
		if (await exists(archived)) {
			throw new Error(`Refusing to overwrite archived source: ${archived}`);
		}
		await rename(downloaded, archived);
	}
	if (!(await exists(archived))) {
		throw new Error(
			`Missing generated source for frame ${item.frame}: ${archived}`,
		);
	}

	const sourceMetadata = await sharp(archived).metadata();
	if (
		sourceMetadata.format !== "png" ||
		sourceMetadata.width !== 3840 ||
		sourceMetadata.height !== 1600
	) {
		throw new Error(
			`Frame ${item.frame} must be a 3840x1600 PNG, received ${sourceMetadata.format} ${sourceMetadata.width}x${sourceMetadata.height}`,
		);
	}

	const websiteFile = path.join(publicDir, `frame-${item.frame}.webp`);
	const websiteMetadata = await sharp(archived)
		.webp({ lossless: true, effort: 6 })
		.toFile(websiteFile);
	const [sourcePixels, websitePixels] = await Promise.all([
		sharp(archived).raw().toBuffer({ resolveWithObject: true }),
		sharp(websiteFile).raw().toBuffer({ resolveWithObject: true }),
	]);
	if (
		sourcePixels.info.width !== websitePixels.info.width ||
		sourcePixels.info.height !== websitePixels.info.height ||
		sourcePixels.info.channels !== websitePixels.info.channels ||
		!sourcePixels.data.equals(websitePixels.data)
	) {
		throw new Error(
			`Lossless pixel verification failed for frame ${item.frame}.`,
		);
	}
	const sha256 = createHash("sha256")
		.update(await readFile(websiteFile))
		.digest("hex");
	finalized.push({
		...item,
		archive: path.relative(projectRoot, archived),
		website: path.relative(projectRoot, websiteFile),
		width: websiteMetadata.width,
		height: websiteMetadata.height,
		encoding: "lossless-webp",
		sha256,
	});
}

const columns = 4;
const rows = 6;
const cellWidth = 600;
const imageHeight = 250;
const labelHeight = 47;
const cellHeight = imageHeight + labelHeight;
const sourceTimes = [
	0.05, 0.65, 1.25, 1.8, 2.35, 2.9, 3.45, 4, 4.55, 4.72, 5.05, 5.22, 5.55, 5.72,
	6.05, 6.22, 6.55, 6.72, 7.05, 7.55, 8.1, 8.65, 9.2, 9.82,
];
const composites = [];

for (let index = 0; index < 24; index += 1) {
	const frame = String(index + 1).padStart(2, "0");
	const left = (index % columns) * cellWidth;
	const top = Math.floor(index / columns) * cellHeight;
	const image = await sharp(path.join(publicDir, `frame-${frame}.webp`))
		.resize(cellWidth, imageHeight, { fit: "contain", background: "#000" })
		.png()
		.toBuffer();
	const label = Buffer.from(`
		<svg xmlns="http://www.w3.org/2000/svg" width="${cellWidth}" height="${labelHeight}">
			<rect width="100%" height="100%" fill="#09090b"/>
			<text x="50%" y="30" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" text-anchor="middle">FRAME ${frame} | ${sourceTimes[index].toFixed(2)}s | GENERATED</text>
		</svg>
	`);
	composites.push({ input: image, left, top });
	composites.push({ input: label, left, top: top + imageHeight });
}

await sharp({
	create: {
		width: columns * cellWidth,
		height: rows * cellHeight,
		channels: 3,
		background: "#09090b",
	},
})
	.composite(composites)
	.png({ compressionLevel: 9 })
	.toFile(contactSheetPath);

console.log(
	JSON.stringify(
		{
			finalized,
			contactSheet: path.relative(projectRoot, contactSheetPath),
		},
		null,
		2,
	),
);
