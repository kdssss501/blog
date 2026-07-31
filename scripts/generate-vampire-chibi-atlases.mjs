import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "吸血鬼女生", "Q版素材");
const outputRoot = path.join(
	root,
	"public",
	"assets",
	"images",
	"xiao",
	"vampire-chibi",
);
const variants = ["black", "white"];
const expressions = ["happy", "shy", "startled"];
const frameSize = 384;
const columns = 4;
const rows = 4;
const atlasSuffix = "-atlas.webp";

async function buildAtlas(variant, expression) {
	const frames = await Promise.all(
		Array.from({ length: 16 }, async (_, index) => {
			const source = path.join(
				sourceRoot,
				variant,
				"sequence",
				expression,
				`frame-${String(index + 1).padStart(2, "0")}.png`,
			);
			const chibi = await sharp(source)
				.ensureAlpha()
				.resize(frameSize, frameSize, {
					fit: "contain",
					background: { r: 0, g: 0, b: 0, alpha: 0 },
				})
				// Remove the original static support line. The composite staff below
				// stays vertical while the character itself swings around its tip.
				.composite([
					{
						input: Buffer.from(
							`<svg width="${frameSize}" height="${frameSize}" xmlns="http://www.w3.org/2000/svg"><rect x="177" y="308" width="30" height="76" fill="#000"/></svg>`,
						),
						blend: "dest-out",
					},
				])
				.png()
				.toBuffer();
			return chibi;
		}),
	);
	const outputDirectory = path.join(outputRoot, variant);
	const output = path.join(
		outputDirectory,
		`${expression}${atlasSuffix}`,
	);
	await mkdir(outputDirectory, { recursive: true });
	await sharp({
		create: {
			width: frameSize * columns,
			height: frameSize * rows,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite(
			frames.map((input, index) => ({
				input,
				left: (index % columns) * frameSize,
				top: Math.floor(index / columns) * frameSize,
			})),
		)
		.webp({ quality: 86, alphaQuality: 100, effort: 6, smartSubsample: true })
		.toFile(output);
	return path.relative(root, output).replaceAll("\\", "/");
}

const outputs = [];
for (const variant of variants) {
	for (const expression of expressions) {
		outputs.push(await buildAtlas(variant, expression));
	}
}

console.log(
	JSON.stringify(
		{
			frameSize,
			frameCount: 16,
			frameDelayMs: 90,
			columns,
		motion: "source-expression-frames; screen-space chat drop",
			outputs,
		},
		null,
		2,
	),
);
