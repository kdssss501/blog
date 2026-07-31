import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const readProjectFile = (relativePath) =>
	readFile(path.join(root, relativePath), "utf8");
const manifest = JSON.parse(
	await readProjectFile("docs/xiao-imagegen-provenance.json"),
);

assert.equal(manifest.schemaVersion, 2);
assert.equal(manifest.generator.provider, "Jiuqiu Workbench API");
assert.equal(manifest.generator.model, "gpt-image-2");
assert.deepEqual(manifest.referenceInputs, {
	count: 4,
	source: "user-supplied screenshots",
	allowedUse: ["composition reference", "visual mood reference"],
	prohibitedUse: ["edit target", "runtime asset"],
});
assert.equal(manifest.runtime.route, "/live2D/");
assert.equal(manifest.runtime.character, "vampire VTuber");
assert.match(manifest.runtime.modelDelivery, /read-only source proxy/);
assert.match(manifest.runtime.soulLinkBoundary, /adapter/i);
assert.equal(manifest.historical.aemeath.runtimeStatus, "not-used");

const expectedTasks = new Map([
	[4118, ["5491ad62-b6f6-40bd-a30f-29bd5ee25b2f", 0]],
	[4119, ["5491ad62-b6f6-40bd-a30f-29bd5ee25b2f", 1]],
	[4120, ["ad357478-ce57-4dab-8989-45fc6250c132", 0]],
	[4121, ["ad357478-ce57-4dab-8989-45fc6250c132", 1]],
	[4122, ["ad357478-ce57-4dab-8989-45fc6250c132", 2]],
	[5649, ["cf3a2d61-638a-4c66-997f-1ca7d37398c6", 0]],
	[5650, ["cf3a2d61-638a-4c66-997f-1ca7d37398c6", 1]],
	[5651, ["cf3a2d61-638a-4c66-997f-1ca7d37398c6", 2]],
	[5652, ["cf3a2d61-638a-4c66-997f-1ca7d37398c6", 3]],
	[5653, ["cf3a2d61-638a-4c66-997f-1ca7d37398c6", 4]],
]);
const tasks = new Map();
for (const operation of manifest.operations) {
	assert.match(
		operation.operationId,
		/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/,
	);
	for (const task of operation.tasks) {
		assert.ok(!tasks.has(task.taskId), `duplicate task ${task.taskId}`);
		const expected = expectedTasks.get(task.taskId);
		assert.ok(expected, `unexpected task ${task.taskId}`);
		assert.equal(operation.operationId, expected[0]);
		assert.equal(
			task.idempotencyKey,
			`codex-imagegen-${expected[0]}-${expected[1]}`,
		);
		assert.deepEqual(task.outputImageKeys, []);
		await Promise.all([
			stat(path.join(root, task.prompt)),
			stat(path.join(root, task.output)),
		]);
		tasks.set(task.taskId, task);
	}
}
assert.deepEqual(
	[...tasks.keys()].sort((left, right) => left - right),
	[...expectedTasks.keys()],
);
assert.equal(tasks.get(4118).runtimeStatus, "not-shipped");
assert.equal(tasks.get(4119).runtimeStatus, "shipped");

const assetPaths = new Set();
for (const asset of manifest.assets) {
	assert.ok(!assetPaths.has(asset.path), `duplicate asset ${asset.path}`);
	assetPaths.add(asset.path);
	if (asset.taskId !== undefined) {
		assert.ok(
			tasks.has(asset.taskId),
			`${asset.path} references an unknown task`,
		);
	} else {
		assert.match(
			asset.role,
			/^runtime-live2d-intro-frame-/,
			`${asset.path} must identify its local Live2D derivation`,
		);
	}
	const absolutePath = path.join(root, asset.path);
	const [buffer, fileStat, metadata] = await Promise.all([
		readFile(absolutePath),
		stat(absolutePath),
		sharp(absolutePath).metadata(),
	]);
	assert.equal(fileStat.size, asset.bytes, `${asset.path} byte size changed`);
	assert.equal(metadata.width, asset.width, `${asset.path} width changed`);
	assert.equal(metadata.height, asset.height, `${asset.path} height changed`);
	assert.equal(
		Boolean(metadata.hasAlpha),
		asset.hasAlpha,
		`${asset.path} alpha changed`,
	);
	assert.equal(
		createHash("sha256").update(buffer).digest("hex"),
		asset.sha256,
		`${asset.path} hash changed`,
	);
	if (
		asset.derivedFrom?.startsWith("generated-art/") ||
		asset.derivedFrom?.startsWith("public/")
	) {
		assert.ok(
			assetPaths.has(asset.derivedFrom),
			`${asset.path} references an undeclared source`,
		);
	}
}

const runtimeAssets = manifest.assets.filter(
	(asset) =>
		asset.path.startsWith("public/") && asset.role.startsWith("runtime-"),
);
assert.deepEqual(runtimeAssets.map((asset) => asset.path).sort(), [
	"public/assets/images/xiao/chain-cinematic-v2/shot-01.webp",
	"public/assets/images/xiao/chain-cinematic-v2/shot-02.webp",
	"public/assets/images/xiao/chain-cinematic-v2/shot-03.webp",
	"public/assets/images/xiao/chain-cinematic-v2/shot-04.webp",
	"public/assets/images/xiao/chain-cinematic-v2/shot-05.webp",
	"public/assets/images/xiao/vampire-gothic/envelope-effects-atlas-4k.png",
	"public/assets/images/xiao/vampire-gothic/envelope-sequence-atlas.png",
	"public/assets/images/xiao/vampire-gothic/silver-ornaments-atlas-4k.png",
]);
assert.ok(
	runtimeAssets.every((asset) =>
		asset.path.includes("/vampire-gothic/") ||
		asset.path.includes("/chain-cinematic-v2/"),
	),
);
const gothicRuntimeAssets = runtimeAssets.filter((asset) =>
	asset.path.includes("/vampire-gothic/"),
);
assert.ok(
	gothicRuntimeAssets
		.filter((asset) => asset.hasAlpha)
		.every((asset) => asset.width === 2880 && asset.height % 360 === 0),
);

const [configSource, proxySource, soulLinkSource] = await Promise.all([
	readProjectFile("src/config/xiaoConfig.ts"),
	readProjectFile("scripts/vampire-live2d-plugin.js"),
	readProjectFile("src/features/xiao/client/soullink-stage.ts"),
]);

for (const runtimeAsset of runtimeAssets) {
	assert.match(
		configSource,
		new RegExp(runtimeAsset.path.replace("public", "").replaceAll("/", "\\/")),
	);
}
assert.doesNotMatch(configSource, /aemeath|old.?xiao|小爱/i);
assert.doesNotMatch(configSource, /public\/.*(?:model3|moc3|texture)/i);
assert.match(proxySource, /VAMPIRE_LIVE2D_SOURCE_DIR/);
assert.match(proxySource, /createReadStream/);
assert.doesNotMatch(
	proxySource,
	/copyFile|writeFile|public\/assets\/images\/xiao/i,
);
assert.match(soulLinkSource, /@soullink-emotion\/engine/);
assert.match(soulLinkSource, /@soullink-emotion\/live2d-pixi/);
assert.match(soulLinkSource, /new Live2DRenderer/);
assert.match(soulLinkSource, /new SoullinkRuntime/);
for (const override of manifest.runtimeOverrides ?? []) {
	const absolutePath = path.join(root, override.path);
	const [buffer, fileStat, metadata] = await Promise.all([
		readFile(absolutePath),
		stat(absolutePath),
		sharp(absolutePath).metadata(),
	]);
	assert.equal(
		fileStat.size,
		override.bytes,
		`${override.path} byte size changed`,
	);
	assert.equal(
		metadata.width,
		override.width,
		`${override.path} width changed`,
	);
	assert.equal(
		metadata.height,
		override.height,
		`${override.path} height changed`,
	);
	assert.equal(
		Boolean(metadata.hasAlpha),
		override.hasAlpha,
		`${override.path} alpha changed`,
	);
	assert.equal(
		createHash("sha256").update(buffer).digest("hex"),
		override.sha256,
		`${override.path} hash changed`,
	);
	assert.match(
		configSource,
		new RegExp(override.path.replace("public", "").replaceAll("/", "\\/")),
	);
}

assert.equal(manifest.videos.length, 1);
for (const video of manifest.videos) {
	const absolutePath = path.join(root, video.path);
	const [buffer, fileStat] = await Promise.all([
		readFile(absolutePath),
		stat(absolutePath),
	]);
	assert.equal(fileStat.size, video.bytes, `${video.path} byte size changed`);
	assert.equal(
		createHash("sha256").update(buffer).digest("hex"),
		video.sha256,
		`${video.path} hash changed`,
	);
	assert.equal(video.hasAudio, false);
	assert.equal(video.durationMs, 10_800);
	assert.match(configSource, new RegExp(video.path.replace("public", "").replaceAll("/", "\\/")));
}

console.log("Xiao vampire asset provenance checks passed.");
