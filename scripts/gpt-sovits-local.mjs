import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
	createLocalGptSovitsRuntime,
	getGptSovitsReferencePath,
} from "../src/server/tts/node-runtime.ts";
import { LOCAL_TTS_EMOTIONS } from "../src/shared/local-tts/contract.ts";

const projectRoot = process.cwd();
const packageRoot = path.resolve(projectRoot, "GPT-SoVITS-v2pro-20250604");
const pythonPath = path.join(packageRoot, "runtime", "python.exe");
const apiPath = path.join(packageRoot, "api_v2.py");
const configRelativePath = path.join("GPT_SoVITS", "configs", "tts_infer.yaml");
const configPath = path.join(packageRoot, configRelativePath);

async function exists(filePath) {
	return access(filePath).then(
		() => true,
		() => false,
	);
}

async function preflight() {
	const required = [
		["内置 Python", pythonPath],
		["api_v2.py", apiPath],
		["v2ProPlus 推理配置", configPath],
		...LOCAL_TTS_EMOTIONS.map((emotion) => [
			`${emotion} 日语参考音频`,
			getGptSovitsReferencePath(emotion, projectRoot),
		]),
	];
	const availability = await Promise.all(
		required.map(async ([label, filePath]) => [label, await exists(filePath)]),
	);
	const missing = availability
		.filter(([, available]) => !available)
		.map(([label]) => label);
	if (missing.length > 0) {
		throw new Error(`本地 GPT-SoVITS 文件不完整：${missing.join("、")}`);
	}

	const config = await readFile(configPath, "utf8");
	const customStart = config.indexOf("custom:");
	const nextProfile = config.indexOf("\nv1:", customStart);
	const customProfile = config.slice(
		customStart,
		nextProfile === -1 ? undefined : nextProfile,
	);
	if (customStart === -1 || !/version:\s*v2ProPlus/u.test(customProfile)) {
		throw new Error("当前 custom 推理配置不是 v2ProPlus。");
	}
	return { filesReady: true, model: "v2ProPlus", references: 4 };
}

async function printHealth() {
	await preflight();
	const health = await createLocalGptSovitsRuntime({ projectRoot }).health();
	console.log(JSON.stringify(health, null, 2));
	if (!health.available) process.exitCode = 1;
}

async function start() {
	const ready = await preflight();
	const existing = await createLocalGptSovitsRuntime({ projectRoot }).health();
	if (existing.upstreamReady) {
		console.log("GPT-SoVITS 已在 127.0.0.1:9880 运行。");
		return;
	}
	console.log(
		`正在启动 GPT-SoVITS ${ready.model}，已校验 ${ready.references} 条参考音频。`,
	);
	const child = spawn(
		pythonPath,
		[
			"-I",
			"api_v2.py",
			"-a",
			"127.0.0.1",
			"-p",
			"9880",
			"-c",
			configRelativePath,
		],
		{
			cwd: packageRoot,
			stdio: "inherit",
			windowsHide: true,
		},
	);
	const stop = () => child.kill();
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);
	child.once("error", (error) => {
		console.error(`GPT-SoVITS 启动失败：${error.message}`);
		process.exitCode = 1;
	});
	const code = await new Promise((resolve) => child.once("close", resolve));
	if (code !== 0) process.exitCode = typeof code === "number" ? code : 1;
}

async function stop() {
	const runtime = createLocalGptSovitsRuntime({ projectRoot });
	if (!(await runtime.health()).upstreamReady) {
		console.log("GPT-SoVITS 当前未运行。");
		return;
	}
	await fetch("http://127.0.0.1:9880/control?command=exit", {
		signal: AbortSignal.timeout(2_000),
	}).catch(() => null);
	for (let attempt = 0; attempt < 20; attempt += 1) {
		await new Promise((resolve) => setTimeout(resolve, 250));
		if (!(await runtime.health()).upstreamReady) {
			console.log("GPT-SoVITS 已停止。");
			return;
		}
	}
	throw new Error("GPT-SoVITS 未在预期时间内停止。");
}

const command = process.argv[2] ?? "health";
try {
	if (command === "start") await start();
	else if (command === "stop") await stop();
	else if (command === "health") await printHealth();
	else if (command === "preflight") {
		console.log(JSON.stringify(await preflight(), null, 2));
	} else {
		throw new Error("用法：gpt-sovits-local.mjs <start|stop|health|preflight>");
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
