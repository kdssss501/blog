import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const referenceRoot = path.resolve(
	".reference/tianshihao2003-dumpling-theme/public",
);
const outputPath = path.resolve("docs/dumpling-assets.json");

async function collect(directory) {
	const result = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) result.push(...(await collect(fullPath)));
		else if (entry.isFile()) result.push(fullPath);
	}
	return result;
}

const files = await collect(referenceRoot);
const items = [];
for (const filePath of files.sort()) {
	const content = await readFile(filePath);
	items.push({
		path: path
			.join("public", path.relative(referenceRoot, filePath))
			.replaceAll("\\", "/"),
		sha256: createHash("sha256").update(content).digest("hex"),
		size: content.byteLength,
	});
}
await writeFile(
	outputPath,
	`${JSON.stringify(
		{
			source: "https://github.com/tianshihao2003/dumpling-theme.git",
			commit: "73b97596c09fb8b27ee7ab56221c270b35a21ae3",
			license: "MIT and user-provided resource authorization",
			items,
		},
		null,
		2,
	)}\n`,
);
console.log(`Generated ${items.length} Dumpling asset records.`);
