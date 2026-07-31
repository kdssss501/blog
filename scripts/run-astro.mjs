import { spawn } from "node:child_process";
import path from "node:path";

const astroCli = path.resolve("node_modules", "astro", "bin", "astro.mjs");
const child = spawn(
	process.execPath,
	["--max-old-space-size=4096", astroCli, ...process.argv.slice(2)],
	{
		stdio: "inherit",
		env: {
			...process.env,
			ASTRO_TELEMETRY_DISABLED: "1",
		},
	},
);

const exitCode = await new Promise((resolve, reject) => {
	child.once("error", reject);
	child.once("exit", (code, signal) => {
		if (signal) {
			reject(new Error(`Astro terminated by signal ${signal}`));
			return;
		}
		resolve(code ?? 1);
	});
});

process.exitCode = exitCode;
