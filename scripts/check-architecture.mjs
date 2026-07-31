import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = join(root, "src");
const supportedExtensions = new Set([
	".astro",
	".js",
	".mjs",
	".svelte",
	".ts",
	".tsx",
]);
const importPattern = /(?:from\s*|import\s*\(|import\s+)["']([^"']+)["']/g;

async function walk(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const absolutePath = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await walk(absolutePath)));
		else if (supportedExtensions.has(extname(entry.name)))
			files.push(absolutePath);
	}
	return files;
}

function layerOf(file) {
	const path = relative(sourceRoot, file).split(sep).join("/");
	if (path.startsWith("shared/")) return "shared";
	if (path.startsWith("features/")) return "features";
	if (path.startsWith("app/")) return "app";
	if (path.startsWith("server/")) return "server";
	if (path.startsWith("pages/")) return "pages";
	return "legacy";
}

function featureOf(file) {
	const match = relative(sourceRoot, file)
		.split(sep)
		.join("/")
		.match(/^features\/([^/]+)\//);
	return match?.[1];
}

function sourcePathOf(file) {
	return relative(sourceRoot, file).split(sep).join("/");
}

function validateImport(file, specifier) {
	const layer = layerOf(file);
	const sourcePath = sourcePathOf(file);
	const errors = [];

	if (
		layer === "shared" &&
		/^@\/(app|features|pages|layouts|config|server)(\/|$)/.test(specifier)
	) {
		errors.push("shared 层不能依赖 app、features、pages、layouts 或 config");
	}
	if (layer === "features" && /^@\/(pages|layouts)(\/|$)/.test(specifier)) {
		errors.push("feature 不能依赖路由或页面布局");
	}
	if (layer === "features" && /^@\/server(\/|$)/.test(specifier)) {
		errors.push("feature 不能依赖服务端基础设施");
	}
	if (
		/^features\/[^/]+\/(?:index|client)\.(?:ts|tsx|js|mjs)$/.test(sourcePath) &&
		specifier.startsWith("node:")
	) {
		errors.push("功能默认入口和 client 入口不能依赖 node:* 模块");
	}
	if (
		/^features\/[^/]+\/ui\//.test(sourcePath) &&
		specifier.startsWith("node:")
	) {
		errors.push("功能 UI 不能依赖 node:* 模块");
	}
	if (layer === "app" && /^@\/pages(\/|$)/.test(specifier)) {
		errors.push("app 层不能依赖路由页面");
	}
	if (layer === "server" && /^@\/(app|pages|layouts)(\/|$)/.test(specifier)) {
		errors.push("server 层不能依赖应用组合或页面层");
	}

	const deepFeatureImport = specifier.match(/^@\/features\/([^/]+)\/(.+)$/);
	const publicFeatureEntry = /^(server|client)$/.test(
		deepFeatureImport?.[2] ?? "",
	);
	if (
		deepFeatureImport &&
		!publicFeatureEntry &&
		featureOf(file) !== deepFeatureImport[1]
	) {
		errors.push(
			`功能 ${deepFeatureImport[1]} 必须通过 @/features/${deepFeatureImport[1]} 公共出口导入`,
		);
	}

	return errors;
}

const files = await walk(sourceRoot);
const violations = [];
for (const file of files) {
	const source = await readFile(file, "utf8");
	for (const match of source.matchAll(importPattern)) {
		for (const message of validateImport(file, match[1])) {
			violations.push(`${relative(root, file)}: ${message} (${match[1]})`);
		}
	}
}

const edgeFiles = [
	join(root, "functions", "[...api].ts"),
	join(root, "functions", "_storage.ts"),
	...files.filter(
		(file) =>
			layerOf(file) === "server" &&
			!file.endsWith("node-runtime.ts") &&
			!file.endsWith("node-file.ts"),
	),
];
for (const file of edgeFiles) {
	const source = await readFile(file, "utf8");
	for (const match of source.matchAll(importPattern)) {
		if (
			match[1].startsWith("node:") ||
			/(?:^|\/)node-(?:runtime|file)$/.test(match[1])
		) {
			violations.push(
				`${relative(root, file)}: Cloudflare 依赖边界不能导入 Node 运行时模块 (${match[1]})`,
			);
		}
	}
}

const featureRoot = join(sourceRoot, "features");
for (const entry of await readdir(featureRoot, { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;
	const featureFiles = await readdir(join(featureRoot, entry.name));
	if (!featureFiles.includes("index.ts")) {
		violations.push(`src/features/${entry.name}: 缺少公共出口 index.ts`);
	}
}

if (violations.length > 0) {
	console.error("Architecture check failed:\n");
	for (const violation of violations) console.error(`- ${violation}`);
	process.exit(1);
}

console.log(`Architecture check passed (${files.length} source files).`);
