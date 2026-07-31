import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { loadEnv } from "vite";

const projectRoot = process.cwd();
const env = loadEnv("production", projectRoot, "");
const sourceRoot = path.resolve(
	projectRoot,
	process.env.VAMPIRE_LIVE2D_SOURCE_DIR ||
		env.VAMPIRE_LIVE2D_SOURCE_DIR ||
		path.join("吸血鬼女生", "吸血鬼_vts"),
);
const outputRoot = path.resolve(
	projectRoot,
	"public",
	"assets",
	"live2d",
	"vampire-web-v1",
);
const textureSize = 4096;

function assertInside(root, target) {
	const relative = path.relative(root, target);
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(`Asset path escaped the model root: ${target}`);
	}
}

function resolveSource(relativePath) {
	const target = path.resolve(sourceRoot, relativePath);
	assertInside(sourceRoot, target);
	return target;
}

async function findModelDocument() {
	const names = await readdir(sourceRoot);
	const name = names.find((entry) => entry.endsWith(".model3.json"));
	if (!name) throw new Error(`No model3 document found in ${sourceRoot}`);
	return JSON.parse(await readFile(resolveSource(name), "utf8"));
}

async function copyReference(reference, outputName) {
	if (typeof reference !== "string" || reference.length === 0) {
		throw new Error(`Missing model reference for ${outputName}`);
	}
	await copyFile(resolveSource(reference), path.join(outputRoot, outputName));
}

async function exportExpressions() {
	const names = (await readdir(sourceRoot))
		.filter((entry) => entry.endsWith(".exp3.json"))
		.sort();
	const parameters = new Set();
	const expressions = [];
	for (const name of names) {
		const source = resolveSource(name);
		const document = JSON.parse(await readFile(source, "utf8"));
		for (const parameter of document.Parameters ?? []) {
			if (typeof parameter?.Id === "string") parameters.add(parameter.Id);
		}
		await copyFile(source, path.join(outputRoot, "expressions", name));
		expressions.push({ Name: name.replace(/\.exp3\.json$/u, ""), File: `expressions/${name}` });
	}

	const neutral = {
		Version: 3,
		FadeInTime: 0.35,
		FadeOutTime: 0.35,
		Parameters: [...parameters].map((Id) => ({ Id, Value: 0, Blend: "Add" })),
	};
	await writeFile(
		path.join(outputRoot, "expressions", "neutral-reset.exp3.json"),
		`${JSON.stringify(neutral)}\n`,
		"utf8",
	);
	expressions.push({
		Name: "neutral-reset",
		File: "expressions/neutral-reset.exp3.json",
	});
	return expressions;
}

async function main() {
	await mkdir(path.join(outputRoot, "textures"), { recursive: true });
	await mkdir(path.join(outputRoot, "expressions"), { recursive: true });
	await mkdir(path.join(outputRoot, "motions"), { recursive: true });

	const sourceModel = await findModelDocument();
	const references = sourceModel.FileReferences ?? {};
	await copyReference(references.Moc, "model.moc3");
	await copyReference(references.Physics, "model.physics3.json");
	await copyReference(references.DisplayInfo, "model.cdi3.json");

	if (!Array.isArray(references.Textures) || references.Textures.length !== 4) {
		throw new Error("Expected exactly four Live2D textures");
	}
	for (const [index, reference] of references.Textures.entries()) {
		const outputName = `texture-${String(index).padStart(2, "0")}.png`;
		await sharp(resolveSource(reference))
			.resize(textureSize, textureSize, { fit: "fill" })
			.png({ compressionLevel: 9, adaptiveFiltering: true })
			.toFile(path.join(outputRoot, "textures", outputName));
	}

	const expressions = await exportExpressions();
	await copyFile(
		resolveSource("Scene1.motion3.json"),
		path.join(outputRoot, "motions", "idle.motion3.json"),
	);

	const model = {
		...sourceModel,
		FileReferences: {
			...references,
			Moc: "model.moc3",
			Textures: references.Textures.map(
				(_, index) => `textures/texture-${String(index).padStart(2, "0")}.png`,
			),
			Physics: "model.physics3.json",
			DisplayInfo: "model.cdi3.json",
			Expressions: expressions,
			Motions: {
				...(references.Motions ?? {}),
				Idle: [{ File: "motions/idle.motion3.json" }],
			},
		},
	};
	await writeFile(
		path.join(outputRoot, "model.model3.json"),
		`${JSON.stringify(model)}\n`,
		"utf8",
	);
	await writeFile(
		path.join(outputRoot, "asset-manifest.json"),
		`${JSON.stringify({ version: 1, textureSize, textureCount: 4, expressionCount: expressions.length })}\n`,
		"utf8",
	);
	console.log(`Vampire web model exported to ${outputRoot}`);
}

await main();
