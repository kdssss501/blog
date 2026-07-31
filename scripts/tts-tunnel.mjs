import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const fileEnvironment = loadEnv("development", projectRoot, "");
const localTtsHealthUrl = "http://127.0.0.1:9880/openapi.json";
const tunnelUrlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/iu;

function environmentValue(name) {
	return process.env[name]?.trim() || fileEnvironment[name]?.trim() || "";
}

function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function isHealthy(url, headers = {}) {
	try {
		const response = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(2_500),
		});
		return response.ok;
	} catch {
		return false;
	}
}

function spawnTracked(name, command, args, env = process.env) {
	const child = spawn(command, args, {
		cwd: projectRoot,
		env,
		stdio: ["ignore", "pipe", "pipe"],
		windowsHide: true,
	});
	const record = { name, child, result: undefined };
	record.exited = new Promise((resolve) => {
		child.once("error", (error) => {
			record.result = { name, code: 1, error };
			resolve(record.result);
		});
		child.once("exit", (code) => {
			if (!record.result)
				record.result = { name, code: code ?? 1, error: null };
			resolve(record.result);
		});
	});
	return record;
}

async function waitUntil(check, timeoutMs, description, record) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (record?.result) {
			throw new Error(
				`${record.name} 提前退出：${record.result.error?.message || `退出码 ${record.result.code}`}`,
			);
		}
		if (await check()) return;
		await delay(300);
	}
	throw new Error(
		`${description}在 ${Math.ceil(timeoutMs / 1_000)} 秒内未就绪。`,
	);
}

async function findCloudflared() {
	const configured = environmentValue("CLOUDFLARED_PATH");
	const bundled = path.join(projectRoot, ".tools", "cloudflared.exe");
	if (configured) return configured;
	if (
		await access(bundled).then(
			() => true,
			() => false,
		)
	)
		return bundled;
	return "cloudflared";
}

function relayLines(stream, onLine) {
	let buffer = "";
	stream.setEncoding("utf8");
	stream.on("data", (chunk) => {
		buffer += chunk;
		const lines = buffer.split(/\r?\n/u);
		buffer = lines.pop() || "";
		for (const line of lines) onLine(line);
	});
}

async function stop(records) {
	for (const record of records.toReversed()) {
		if (!record.result) record.child.kill("SIGTERM");
	}
	await Promise.race([
		Promise.all(records.map((record) => record.exited)),
		delay(4_000),
	]);
	for (const record of records) {
		if (!record.result) record.child.kill("SIGKILL");
	}
}

async function runSession(records) {
	const token =
		environmentValue("TTS_SERVICE_TOKEN") || randomBytes(32).toString("hex");
	const port = environmentValue("TTS_GATEWAY_PORT") || "8788";
	const authorization = { Authorization: `Bearer ${token}` };

	if (!(await isHealthy(localTtsHealthUrl))) {
		console.log("[TTS] 正在启动 GPT-SoVITS……");
		const tts = spawnTracked("GPT-SoVITS", process.execPath, [
			"--experimental-strip-types",
			path.join(projectRoot, "scripts", "gpt-sovits-local.mjs"),
			"start",
		]);
		tts.child.stdout.pipe(process.stdout);
		tts.child.stderr.pipe(process.stderr);
		records.push(tts);
		await waitUntil(
			() => isHealthy(localTtsHealthUrl),
			90_000,
			"GPT-SoVITS",
			tts,
		);
	}

	const gatewayUrl = `http://127.0.0.1:${port}`;
	const gateway = spawnTracked(
		"TTS Gateway",
		process.execPath,
		[
			"--experimental-strip-types",
			path.join(projectRoot, "scripts", "tts-gateway.mjs"),
		],
		{ ...process.env, TTS_SERVICE_TOKEN: token, TTS_GATEWAY_PORT: port },
	);
	gateway.child.stdout.pipe(process.stdout);
	gateway.child.stderr.pipe(process.stderr);
	records.push(gateway);
	await waitUntil(
		() => isHealthy(`${gatewayUrl}/health`, authorization),
		15_000,
		"TTS Gateway",
		gateway,
	);

	const cloudflared = await findCloudflared();
	console.log("[Tunnel] 正在申请临时 HTTPS 地址……");
	const tunnel = spawnTracked("Cloudflare Tunnel", cloudflared, [
		"tunnel",
		"--no-autoupdate",
		"--url",
		gatewayUrl,
	]);
	records.push(tunnel);
	let resolvePublicUrl;
	const publicUrlReady = new Promise((resolve) => {
		resolvePublicUrl = resolve;
	});
	const inspectLine = (line) => {
		const match = line.match(tunnelUrlPattern);
		if (match) resolvePublicUrl(match[0]);
		else if (line.trim()) console.log(`[Tunnel] ${line.trim()}`);
	};
	relayLines(tunnel.child.stdout, inspectLine);
	relayLines(tunnel.child.stderr, inspectLine);

	let timer;
	const publicUrl = await Promise.race([
		publicUrlReady,
		new Promise((_, reject) => {
			timer = setTimeout(
				() => reject(new Error("Cloudflare Tunnel 在 30 秒内未返回公网地址。")),
				30_000,
			);
		}),
	]);
	clearTimeout(timer);
	try {
		await waitUntil(
			() => isHealthy(`${publicUrl}/health`, authorization),
			20_000,
			"公网 TTS Gateway",
			tunnel,
		);
	} catch (error) {
		if (tunnel.result) throw error;
		console.warn(
			"[Tunnel] 临时域名尚未在本机 DNS 生效；Tunnel 已创建，Vercel 或公共 DNS 生效后可访问。",
		);
	}

	console.log("\n临时 Tunnel 已就绪（地址在本次进程退出后失效）：");
	console.log(`TTS_UPSTREAM_URL=${publicUrl}`);
	console.log(
		`TTS_SERVICE_TOKEN=${process.env.TTS_TUNNEL_HIDE_TOKEN === "1" ? "[hidden]" : token}`,
	);
	console.log("按 Ctrl+C 停止 Tunnel；正式部署时改用固定域名 Tunnel。\n");

	let resolveSignal;
	const signal = new Promise((resolve) => {
		resolveSignal = resolve;
	});
	for (const name of ["SIGINT", "SIGTERM"]) {
		process.once(name, () => resolveSignal());
	}
	await Promise.race([signal, ...records.map((record) => record.exited)]);
}

async function main() {
	const records = [];
	try {
		await runSession(records);
	} finally {
		await stop(records);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
