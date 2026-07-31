import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = new URL("../../", import.meta.url);
const aliases = [
	["@components/", "src/components/"],
	["@assets/", "src/assets/"],
	["@constants/", "src/constants/"],
	["@utils/", "src/utils/"],
	["@i18n/", "src/i18n/"],
	["@layouts/", "src/layouts/"],
	["@/", "src/"],
];
const extensions = ["", ".ts", ".js", ".mjs", "/index.ts", "/index.js"];

async function existingModule(baseUrl) {
	for (const extension of extensions) {
		const candidate = new URL(`${baseUrl.href}${extension}`);
		try {
			if ((await stat(fileURLToPath(candidate))).isFile())
				return candidate.href;
		} catch {
			// Try the next supported TypeScript/JavaScript module shape.
		}
	}
	return null;
}

export async function resolve(specifier, context, nextResolve) {
	const alias = aliases.find(([prefix]) => specifier.startsWith(prefix));
	if (alias) {
		const [prefix, target] = alias;
		const resolved = await existingModule(
			new URL(`${target}${specifier.slice(prefix.length)}`, projectRoot),
		);
		if (resolved) return { url: resolved, shortCircuit: true };
	}

	if (
		(specifier.startsWith("./") || specifier.startsWith("../")) &&
		context.parentURL
	) {
		const resolved = await existingModule(
			new URL(specifier, context.parentURL),
		);
		if (resolved) return { url: resolved, shortCircuit: true };
	}

	return nextResolve(specifier, context);
}
