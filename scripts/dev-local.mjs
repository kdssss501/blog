import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const ttsHealthUrl = "http://127.0.0.1:9880/openapi.json";
const defaultAstroPort = 4321;
const defaultTtsTimeoutMs = 90_000;

function printHelp() {
	console.log(`本地博客开发启动器

用法：
	pnpm dev
	pnpm dev -- --port 4325

选项：
  -p, --port <端口>  Astro 开发服务器端口（默认 4321）
  -h, --help         显示帮助

环境变量：
  ASTRO_PORT             Astro 端口，命令行 --port 优先
  TTS_START_TIMEOUT_MS   GPT-SoVITS 冷启动等待时间（默认 90000 毫秒）

启动器会复用 127.0.0.1:9880 上已健康的 GPT-SoVITS。退出时只停止
由本次命令启动的进程，不会停止启动前已经运行的 TTS 服务。`);
}

function parsePositiveInteger(value, label, { max } = {}) {
	if (!/^\d+$/u.test(value ?? "")) {
		throw new Error(`${label} 必须是正整数。`);
	}
	const parsed = Number(value);
	if (parsed < 1 || (max !== undefined && parsed > max)) {
		throw new Error(
			`${label} 必须在 1 到 ${max ?? Number.MAX_SAFE_INTEGER} 之间。`,
		);
	}
	return parsed;
}

function parseArguments(argv) {
	let portValue = process.env.ASTRO_PORT || String(defaultAstroPort);
	const astroArguments = [];
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--") continue;
		if (argument === "--help" || argument === "-h") {
			return { help: true };
		}
		if (argument === "--port" || argument === "-p") {
			const next = argv[index + 1];
			if (next === undefined) throw new Error(`${argument} 缺少端口值。`);
			portValue = next;
			index += 1;
			continue;
		}
		if (argument.startsWith("--port=")) {
			portValue = argument.slice("--port=".length);
			continue;
		}
		astroArguments.push(argument);
	}
	return {
		help: false,
		port: parsePositiveInteger(portValue, "Astro 端口", { max: 65_535 }),
		astroArguments,
	};
}

function isPortListening(port) {
	return new Promise((resolve) => {
		const socket = net.createConnection({ host: "127.0.0.1", port });
		const finish = (listening) => {
			socket.destroy();
			resolve(listening);
		};
		socket.setTimeout(800);
		socket.once("connect", () => finish(true));
		socket.once("timeout", () => finish(false));
		socket.once("error", () => finish(false));
	});
}

async function isTtsHealthy() {
	try {
		const response = await fetch(ttsHealthUrl, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(1_500),
		});
		return response.ok;
	} catch {
		return false;
	}
}

function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function spawnTracked(name, command, args) {
	const child = spawn(command, args, {
		cwd: projectRoot,
		stdio: "inherit",
		windowsHide: true,
		env: {
			...process.env,
			ASTRO_TELEMETRY_DISABLED: "1",
		},
	});
	const record = {
		name,
		child,
		result: undefined,
		exited: undefined,
	};
	record.exited = new Promise((resolve) => {
		child.once("error", (error) => {
			record.result = { name, code: 1, signal: null, error };
			resolve(record.result);
		});
		child.once("exit", (code, signal) => {
			if (record.result) return;
			record.result = { name, code: code ?? 1, signal, error: null };
			resolve(record.result);
		});
	});
	return record;
}

async function waitForTts(record, timeoutMs, isStopping) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (isStopping()) return false;
		if (record.result) {
			const detail =
				record.result.error?.message ??
				`退出码 ${record.result.code}${record.result.signal ? `，信号 ${record.result.signal}` : ""}`;
			throw new Error(`GPT-SoVITS 在健康检查通过前退出：${detail}`);
		}
		if (await isTtsHealthy()) return true;
		await delay(500);
	}
	throw new Error(`GPT-SoVITS 在 ${Math.ceil(timeoutMs / 1_000)} 秒内未就绪。`);
}

async function stopRecords(records, signal) {
	const active = records.filter((record) => !record.result);
	for (const record of active.toReversed()) {
		record.child.kill(signal);
	}
	if (active.length === 0) return;

	await Promise.race([
		Promise.all(active.map((record) => record.exited)),
		delay(5_000),
	]);
	for (const record of active.filter((entry) => !entry.result)) {
		console.warn(`${record.name} 未及时退出，正在强制停止。`);
		record.child.kill("SIGKILL");
	}
}

async function main() {
	const options = parseArguments(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return 0;
	}

	if (await isPortListening(options.port)) {
		throw new Error(
			`127.0.0.1:${options.port} 已被占用；为避免启动重复的 Astro 进程，本次未启动。`,
		);
	}

	const timeoutMs = parsePositiveInteger(
		process.env.TTS_START_TIMEOUT_MS || String(defaultTtsTimeoutMs),
		"TTS_START_TIMEOUT_MS",
	);
	const records = [];
	let requestedSignal;
	let resolveSignal;
	const signalReceived = new Promise((resolve) => {
		resolveSignal = resolve;
	});
	for (const signal of ["SIGINT", "SIGTERM"]) {
		process.once(signal, () => {
			requestedSignal ??= signal;
			resolveSignal({ name: "launcher", code: 0, signal, error: null });
		});
	}

	try {
		if (await isTtsHealthy()) {
			console.log("[TTS] GPT-SoVITS 已健康，复用现有服务。");
		} else {
			console.log("[TTS] 正在启动 GPT-SoVITS，首次加载通常需要约 20 秒……");
			const tts = spawnTracked("GPT-SoVITS", process.execPath, [
				"--experimental-strip-types",
				path.join(projectRoot, "scripts", "gpt-sovits-local.mjs"),
				"start",
			]);
			records.push(tts);
			const ready = await waitForTts(
				tts,
				timeoutMs,
				() => requestedSignal !== undefined,
			);
			if (!ready) return 0;
			console.log("[TTS] GPT-SoVITS 已就绪。");
		}

		if (requestedSignal) return 0;
		console.log(`[Web] 正在启动 Astro：http://127.0.0.1:${options.port}`);
		const astroCli = path.join(
			projectRoot,
			"node_modules",
			"astro",
			"bin",
			"astro.mjs",
		);
		const astro = spawnTracked("Astro", process.execPath, [
			"--max-old-space-size=4096",
			astroCli,
			"dev",
			"--port",
			String(options.port),
			"--host",
			"127.0.0.1",
			...options.astroArguments,
		]);
		records.push(astro);

		const outcome = await Promise.race([
			signalReceived,
			...records.map((record) => record.exited),
		]);
		if (outcome.name === "launcher") return 0;
		if (outcome.error) {
			throw new Error(`${outcome.name} 启动失败：${outcome.error.message}`);
		}
		if (outcome.signal) {
			console.error(`${outcome.name} 被信号 ${outcome.signal} 终止。`);
			return 1;
		}
		if (outcome.code !== 0) return outcome.code;
		console.error(`${outcome.name} 意外退出，正在停止其余本地服务。`);
		return 1;
	} finally {
		await stopRecords(records, requestedSignal ?? "SIGTERM");
	}
}

try {
	process.exitCode = await main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
