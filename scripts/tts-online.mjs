import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..");
const fileEnvironment = loadEnv("development", projectRoot, "");
const upstreamPattern = /^TTS_UPSTREAM_URL=(https:\/\/[^\s/]+(?:\/[^\s]*)?)\s*$/u;

export function parseArguments(argv) {
	const options = { dryRun: false, help: false };
	for (const argument of argv) {
		if (argument === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (argument === "--help" || argument === "-h") {
			options.help = true;
			continue;
		}
		throw new Error(`不支持的参数：${argument}`);
	}
	return options;
}

export function extractUpstreamUrl(line) {
	return line.match(upstreamPattern)?.[1] ?? null;
}

export function resolveServiceToken(environment = {}) {
	const configured = environment.TTS_SERVICE_TOKEN
		?.replace(/\uFEFF/gu, "")
		.trim();
	if (configured && /^[A-Za-z0-9._~-]{32,}$/u.test(configured)) {
		return { token: configured, generated: false };
	}
	return { token: randomBytes(32).toString("hex"), generated: true };
}

export function parseGatewayPort(value) {
	if (!/^\d+$/u.test(value ?? "")) {
		throw new Error("TTS_GATEWAY_PORT 必须是 1 到 65535 之间的整数。");
	}
	const port = Number(value);
	if (port < 1 || port > 65_535) {
		throw new Error("TTS_GATEWAY_PORT 必须是 1 到 65535 之间的整数。");
	}
	return port;
}

function isPortAvailable(port) {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.once("error", () => resolve(false));
		server.listen(port, "127.0.0.1", () => {
			server.close(() => resolve(true));
		});
	});
}

async function resolveGatewayPort(environment) {
	const configured = environment.TTS_GATEWAY_PORT?.trim();
	if (configured) {
		const port = parseGatewayPort(configured);
		if (await isPortAvailable(port)) return port;
		throw new Error(
			`TTS_GATEWAY_PORT=${port} 已被占用。请停止占用进程，或配置另一个端口后重试。`,
		);
	}
	for (let port = 8788; port <= 8798; port += 1) {
		if (await isPortAvailable(port)) return port;
	}
	throw new Error("8788 到 8798 均已被占用，无法启动本地 TTS 网关。");
}

function printHelp() {
	console.log(`将本机 GPT-SoVITS 临时接入 Vercel 生产站点。

用法：
  pnpm tts:online
  pnpm tts:online --dry-run

流程：
  1. 启动 GPT-SoVITS、本地鉴权网关与 Cloudflare Quick Tunnel。
  2. 将 Tunnel 地址和 TTS Token 覆盖到 Vercel Production 环境变量。
  3. 重新部署生产站点，随后保持本终端运行以维持语音服务。

说明：
  - 未配置 TTS_SERVICE_TOKEN 时，会为本次启动生成一枚安全随机 Token，不显示在日志中。
  - Quick Tunnel 地址每次启动都会变化；本命令会自动更新 Vercel。
  - 默认网关端口被占用时，会自动改用 8788 到 8798 中的空闲端口。
  - Ctrl+C 会关闭 Tunnel、本地网关，以及本命令启动的 GPT-SoVITS。`);
}

function createTrackedProcess(name, command, args, options = {}) {
	const child = spawn(command, args, {
		cwd: projectRoot,
		windowsHide: true,
		shell: options.shell ?? false,
		stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
		env: options.env ?? process.env,
	});
	const exited = new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", (code, signal) => resolve({ code, signal }));
	});
	return { name, child, exited };
}

function relayLines(stream, callback) {
	let buffer = "";
	stream.setEncoding("utf8");
	stream.on("data", (chunk) => {
		process.stdout.write(chunk);
		buffer += chunk;
		const lines = buffer.split(/\r?\n/u);
		buffer = lines.pop() || "";
		for (const line of lines) callback(line);
	});
}

async function runVercelCommand(args, input, label) {
	const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
	const processRecord = createTrackedProcess(
		label,
		command,
		["dlx", "vercel", ...args],
		{
			stdio: ["pipe", "inherit", "inherit"],
			shell: process.platform === "win32",
		},
	);
	if (input !== undefined) processRecord.child.stdin.end(`${input}\n`);
	else processRecord.child.stdin.end();
	const result = await processRecord.exited;
	if (result.code !== 0) {
		throw new Error(`${label} 失败（退出码 ${result.code ?? "unknown"}）。`);
	}
}

async function publishToVercel(upstreamUrl, token) {
	console.log("\n[Vercel] 正在更新 Production TTS 配置……");
	await runVercelCommand(
		[
			"env",
			"add",
			"TTS_UPSTREAM_URL",
			"production",
			"--force",
			"--sensitive",
			"--yes",
		],
		upstreamUrl,
		"更新 TTS_UPSTREAM_URL",
	);
	await runVercelCommand(
		[
			"env",
			"add",
			"TTS_SERVICE_TOKEN",
			"production",
			"--force",
			"--sensitive",
			"--yes",
		],
		token,
		"更新 TTS_SERVICE_TOKEN",
	);
	console.log("[Vercel] 正在部署生产站点……");
	await runVercelCommand(
		["deploy", "--prod", "--yes"],
		undefined,
		"部署 Vercel Production",
	);
}

function stopProcess(record) {
	if (record.child.exitCode !== null || record.child.killed) return;
	record.child.kill("SIGTERM");
}

async function main() {
	const options = parseArguments(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const environment = { ...fileEnvironment, ...process.env };
	const { token, generated } = resolveServiceToken(environment);
	const gatewayPort = await resolveGatewayPort(environment);
	if (options.dryRun) {
		console.log(
			JSON.stringify({
				ready: true,
				tokenSource: generated ? "generated-per-session" : "configured",
				steps: ["start-local-tts", "open-quick-tunnel", "update-vercel", "deploy-production"],
			}),
		);
		return;
	}

	console.log(
		`[TTS Online] 将${generated ? "生成本次会话专用 Token 并" : "复用已配置 Token 并"}启动公网语音连接。`,
	);
	if (gatewayPort !== 8788) {
		console.log(`[TTS Online] 8788 已被占用，改用本机网关端口 ${gatewayPort}。`);
	}
	const tunnel = createTrackedProcess(
		"TTS Tunnel",
		process.execPath,
		["--experimental-strip-types", path.join(projectRoot, "scripts", "tts-tunnel.mjs")],
		{
			env: {
				...environment,
				TTS_SERVICE_TOKEN: token,
				TTS_TUNNEL_HIDE_TOKEN: "1",
				TTS_GATEWAY_PORT: String(gatewayPort),
			},
		},
	);

	let resolveUpstream;
	const upstreamReady = new Promise((resolve) => {
		resolveUpstream = resolve;
	});
	const inspectLine = (line) => {
		const upstreamUrl = extractUpstreamUrl(line);
		if (upstreamUrl) resolveUpstream(upstreamUrl);
	};
	relayLines(tunnel.child.stdout, inspectLine);
	relayLines(tunnel.child.stderr, inspectLine);

	let stoppedBySignal = false;
	const stopOnSignal = () => {
		stoppedBySignal = true;
		stopProcess(tunnel);
	};
	process.once("SIGINT", stopOnSignal);
	process.once("SIGTERM", stopOnSignal);

	try {
		const upstreamUrl = await Promise.race([
			upstreamReady,
			tunnel.exited.then(({ code, signal }) => {
				throw new Error(
					`TTS Tunnel 在公网地址就绪前退出（${signal || `退出码 ${code ?? "unknown"}`}）。`,
				);
			}),
		]);
		await publishToVercel(upstreamUrl, token);
		console.log(
			"\n[TTS Online] 已接入 Vercel Production。请保持本终端运行；按 Ctrl+C 会停止本机语音服务。\n",
		);
		const outcome = await tunnel.exited;
		if (!stoppedBySignal && outcome.code !== 0) {
			throw new Error(
				`TTS Tunnel 意外退出（${outcome.signal || `退出码 ${outcome.code ?? "unknown"}`}）。`,
			);
		}
	} finally {
		process.removeListener("SIGINT", stopOnSignal);
		process.removeListener("SIGTERM", stopOnSignal);
		stopProcess(tunnel);
		await Promise.race([
			tunnel.exited,
			new Promise((resolve) => setTimeout(resolve, 5_000)),
		]);
	}
}

if (path.resolve(process.argv[1] || "") === scriptPath) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
