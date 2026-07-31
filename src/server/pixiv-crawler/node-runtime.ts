import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import type {
	PixivCrawlerRuntime,
	PixivCrawlerStartInput,
	PixivCrawlerStatus,
} from "@/shared/pixiv-crawler/contract";

const MAX_LOG_LENGTH = 24_000;
const IMAGE_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)$/i;

function safeEnvironment(): NodeJS.ProcessEnv {
	const environment = { ...process.env, PYTHONUTF8: "1" };
	for (const key of [
		"PIXIV_COOKIE",
		"PIXIV_UID",
		"BLOG_ADMIN_TOKEN",
		"AI_API_KEY",
		"GITHUB_CONTENT_TOKEN",
	]) {
		delete environment[key];
	}
	return environment;
}

async function countImages(directory: string): Promise<number> {
	let total = 0;
	for (const entry of await readdir(directory, { withFileTypes: true }).catch(
		() => [],
	)) {
		const childPath = path.join(directory, entry.name);
		if (entry.isDirectory()) total += await countImages(childPath);
		else if (entry.isFile() && IMAGE_PATTERN.test(entry.name)) total += 1;
	}
	return total;
}

function displayArgument(value: string): string {
	return /\s/.test(value) ? JSON.stringify(value) : value;
}

class LocalPixivCrawlerRuntime implements PixivCrawlerRuntime {
	private readonly root = path.resolve("PixivCrawler");
	private readonly script = path.join(this.root, "run_crawler.py");
	private readonly python =
		process.platform === "win32"
			? path.join(this.root, ".venv", "Scripts", "python.exe")
			: path.join(this.root, ".venv", "bin", "python");
	private child: ChildProcessWithoutNullStreams | null = null;
	private outputDirectory = "";
	private status: PixivCrawlerStatus = {
		available: false,
		state: "unavailable",
	};
	private cancelRequested = false;

	private availability(): { available: boolean; reason?: string } {
		if (!existsSync(this.root)) {
			return { available: false, reason: "本机未找到 PixivCrawler 目录。" };
		}
		if (!existsSync(this.python) || !existsSync(this.script)) {
			return {
				available: false,
				reason: "PixivCrawler 的 Python 环境尚未安装完整。",
			};
		}
		return { available: true };
	}

	async getStatus(): Promise<PixivCrawlerStatus> {
		const availability = this.availability();
		if (!availability.available) {
			return {
				available: false,
				state: "unavailable",
				reason: availability.reason,
			};
		}
		if (this.status.state === "unavailable") {
			this.status = { available: true, state: "idle" };
		}
		return { ...this.status };
	}

	async start(input: PixivCrawlerStartInput): Promise<PixivCrawlerStatus> {
		const current = await this.getStatus();
		if (!current.available) return current;
		if (this.child && this.status.state === "running") {
			return { ...this.status, reason: "已有采集任务正在运行。" };
		}

		const jobId = `${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
		this.outputDirectory = path.join(
			this.root,
			"downloads",
			"album-inbox",
			jobId,
		);
		await mkdir(this.outputDirectory, { recursive: true });

		const args = [this.script, input.mode];
		if (input.mode !== "ranking") args.push(input.query);
		args.push("--number", String(input.count));
		if (input.mode === "ranking" && input.date) {
			args.push("--date", input.date);
		}
		args.push("--output", this.outputDirectory);
		if (input.mode === "keyword") args.push("--mode", "safe");

		const publicArgs = [
			"run.cmd",
			...args.slice(1, -2),
			"--output",
			`downloads/album-inbox/${jobId}`,
		];
		this.cancelRequested = false;
		this.status = {
			available: true,
			state: "running",
			jobId,
			mode: input.mode,
			query: input.query,
			count: input.count,
			startedAt: new Date().toISOString(),
			outputPath: `PixivCrawler/downloads/album-inbox/${jobId}`,
			imageCount: 0,
			command: publicArgs.map(displayArgument).join(" "),
			log: "任务已启动，正在等待 Pixiv 响应……",
		};

		const child = spawn(this.python, args, {
			cwd: this.root,
			env: safeEnvironment(),
			windowsHide: true,
			stdio: "pipe",
		});
		this.child = child;
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => this.appendLog(chunk));
		child.stderr.on("data", (chunk: string) => this.appendLog(chunk));
		child.once("error", (error) => {
			this.finish("failed", `无法启动采集器：${error.message}`);
		});
		child.once("close", async (code) => {
			if (this.child !== child) return;
			const imageCount = await countImages(this.outputDirectory);
			this.status.imageCount = imageCount;
			if (this.cancelRequested) this.finish("cancelled", "任务已停止。");
			else if (code === 0)
				this.finish("succeeded", `采集完成，共保存 ${imageCount} 张图片。`);
			else this.finish("failed", `采集器退出，状态码 ${code ?? "unknown"}。`);
		});
		return { ...this.status };
	}

	async cancel(): Promise<PixivCrawlerStatus> {
		if (!this.child || this.status.state !== "running") return this.getStatus();
		this.cancelRequested = true;
		this.appendLog("\n正在停止任务……\n");
		this.child.kill();
		return { ...this.status };
	}

	private appendLog(chunk: string) {
		const log = `${this.status.log ?? ""}${chunk}`;
		this.status.log = log.slice(-MAX_LOG_LENGTH);
	}

	private finish(
		state: Extract<
			PixivCrawlerStatus["state"],
			"succeeded" | "failed" | "cancelled"
		>,
		message: string,
	) {
		this.appendLog(`\n${message}\n`);
		this.status.state = state;
		this.status.finishedAt = new Date().toISOString();
		this.status.reason = state === "failed" ? message : undefined;
		this.child = null;
	}
}

let runtime: PixivCrawlerRuntime | undefined;

export function getLocalPixivCrawlerRuntime(): PixivCrawlerRuntime {
	runtime ??= new LocalPixivCrawlerRuntime();
	return runtime;
}
