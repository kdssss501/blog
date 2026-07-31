import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.resolve(
	root,
	"..",
	"..",
	"..",
	"Downloads",
	"motionsites-prompts-main",
	"motionsites-prompts-main",
	"Yuimi-chaya.github.io",
	"src",
	"themes",
	"kisara",
	"pages",
	"HomePage.astro",
);
const outputPath = path.join(
	root,
	"src",
	"features",
	"xiao",
	"client",
	"vampire-yuimi-gate-runtime.ts",
);
const auditPath = path.join(root, "docs", "vampire-yuimi-gate-port.json");
const source = await readFile(sourcePath, "utf8");
const scheduleIndex = source.indexOf("const scheduleKisaraHome");
const startToken = "        (() => {";
const endToken = "        })();";
const start = source.indexOf(startToken, scheduleIndex);
const end = source.indexOf(endToken, start);

if (scheduleIndex < 0 || start < 0 || end < 0 || end <= start) {
	throw new Error("Unable to locate the Yuimi gate runtime body.");
}

const body = source.slice(start + startToken.length, end);
const bodyHash = createHash("sha256").update(body).digest("hex");
const runtime = `// @ts-nocheck
// Mechanical port from Yuimi-chaya.github.io HomePage.astro.
// Source body SHA-256: ${bodyHash}

export function mountVampireYuimiGateRuntime() {
	const releaseStaleKisaraHomeRuntime = (candidate) => {
		if (!(candidate instanceof HTMLElement) || candidate.dataset.bound !== "true") return false;
		const candidateAutoControl = candidate.querySelector("[data-kisara-auto]");
		if (
			!(candidateAutoControl instanceof HTMLElement)
			|| candidateAutoControl.dataset.kisaraRuntimeBound === "true"
		) return false;
		window.__yuimiKisaraHomeCleanup?.();
		candidate.removeAttribute("data-bound");
		candidate.removeAttribute("data-binding");
		return true;
	};

	(() => {${body}
	})();

	return () => window.__yuimiKisaraHomeCleanup?.();
}
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, runtime, "utf8");
await writeFile(
	auditPath,
	JSON.stringify(
		{
			source: "Yuimi-chaya.github.io/src/themes/kisara/pages/HomePage.astro",
			sourceRange: "inner gate IIFE starting after scheduleKisaraHome",
			bodySha256: bodyHash,
			output: "src/features/xiao/client/vampire-yuimi-gate-runtime.ts",
			portedAt: new Date().toISOString(),
		},
		null,
		2,
	),
	"utf8",
);

console.log(JSON.stringify({ outputPath, bodyHash, bytes: Buffer.byteLength(runtime) }));
