import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
	getPanelDirection,
	getShutterPinEndDistance,
	normalizeShutterPanels,
} from "../../src/features/home/model/portfolio-shutter.js";

assert.equal(getShutterPinEndDistance(4000, 1000), 4000);
assert.equal(getShutterPinEndDistance(1000, 1200), 4800);
assert.equal(getShutterPinEndDistance("invalid", 1000), 4000);
assert.deepEqual(
	Array.from({ length: 5 }, (_, index) => getPanelDirection(index)),
	["down", "up", "down", "up", "down"],
);

const panels = normalizeShutterPanels(
	Array.from({ length: 5 }, (_, index) => ({ title: `panel-${index}` })),
);
assert.deepEqual(
	panels.map(({ index, direction }) => ({ index, direction })),
	[
		{ index: 0, direction: "down" },
		{ index: 1, direction: "up" },
		{ index: 2, direction: "down" },
		{ index: 3, direction: "up" },
		{ index: 4, direction: "down" },
	],
);
assert.throws(
	() => normalizeShutterPanels(panels.slice(0, 4)),
	/exactly 5 panels/,
);

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const homePage = readFileSync(
	path.join(repoRoot, "src/pages/index.astro"),
	"utf8",
);
assert.match(
	homePage,
	/<HomeHero\s*\/>[\s\S]*<HomeDisplayLayer\s*\/>[\s\S]*<HomeTicker\s*\/>[\s\S]*<HomePhotoDeck\s*\/>[\s\S]*<HomeDataLayer\s*\/>/,
);
assert.doesNotMatch(homePage, /home-cinematic-sequence/);

const displayLayer = readFileSync(
	path.join(repoRoot, "src/features/home/ui/HomeDisplayLayer.astro"),
	"utf8",
);
const homeConfigSource = readFileSync(
	path.join(repoRoot, "src/config/homeConfig.ts"),
	"utf8",
);
const shutterStyles = readFileSync(
	path.join(repoRoot, "src/styles/components/home-portfolio-shutter.css"),
	"utf8",
);
assert.match(displayLayer, /data-display-backdrop/);
assert.match(displayLayer, /const STORY_START = 2\.62;/);
assert.match(displayLayer, /const STORY_FRAME_STEP = 0\.32;/);
assert.match(displayLayer, /const STORY_CROSSFADE_DURATION = 0\.12;/);
assert.match(displayLayer, /const STORY_CAPTION_FADE_DURATION = 0\.06;/);
assert.match(displayLayer, /transitionAt \+ STORY_CAPTION_FADE_DURATION/);
assert.match(displayLayer, /const STORY_END = 10\.8;/);
assert.match(displayLayer, /const FINAL_VIDEO_START = 14\.6;/);
assert.match(displayLayer, /const TIMELINE_END = 16\.8;/);
assert.doesNotMatch(displayLayer, /scale: 1\.0(?:18|52)/);
assert.doesNotMatch(displayLayer, /xPercent: direction/);
assert.match(
	shutterStyles,
	/\.home-scroll-cinematic__frame[\s\S]*object-fit: contain;[\s\S]*object-position: center;/,
);
assert.match(displayLayer, /syncFinalVideoPlayback\(self\.progress\)/);
assert.match(displayLayer, /finalVideo\.pause\(\)/);
assert.match(displayLayer, /data-scroll-cinematic-caption/);
assert.match(displayLayer, /window\.swup\.hooks\.on\("visit:start"/);
assert.match(displayLayer, /if \(isHomeRoute\(\)\) teardownDisplay\(\);/);
assert.doesNotMatch(displayLayer, /pinReparent:\s*true/);
assert.match(
	displayLayer,
	/home-portfolio-shutter__rail[\s\S]*data-scroll-cinematic[\s\S]*data-shutter-interlude/,
);
assert.doesNotMatch(
	displayLayer,
	/asset instanceof HTMLVideoElement[\s\S]{0,260}asset\.play\(\)/,
);

const cinematicManifest = JSON.parse(
	readFileSync(
		path.join(
			repoRoot,
			"public/assets/images/home/artoria-scroll-4k/manifest.json",
		),
		"utf8",
	),
);
assert.equal(cinematicManifest.width, 3840);
assert.equal(cinematicManifest.height, 1600);
assert.deepEqual(cinematicManifest.encoding, {
	format: "webp",
	mode: "lossless",
	source: "generated-art/artoria-cinematic-v2/generated",
});
assert.equal(cinematicManifest.frames.length, 24);
assert.deepEqual(
	cinematicManifest.frames.map((frame) => frame.index),
	Array.from({ length: 24 }, (_, index) => index),
);
assert.deepEqual(
	cinematicManifest.frames.map((frame) => frame.sourceTime ?? frame.time),
	[
		0.05, 0.65, 1.25, 1.8, 2.35, 2.9, 3.45, 4, 4.55, 4.72, 5.05, 5.22, 5.55,
		5.72, 6.05, 6.22, 6.55, 6.72, 7.05, 7.55, 8.1, 8.65, 9.2, 9.82,
	],
);
assert.ok(
	cinematicManifest.frames.every(
		(frame, index, frames) =>
			index === 0 ||
			(frame.sourceTime ?? frame.time) >
				(frames[index - 1].sourceTime ?? frames[index - 1].time),
	),
);
assert.equal(
	new Set(
		cinematicManifest.frames.map((frame) => frame.file ?? frame.outputFile),
	).size,
	24,
);
assert.ok(
	cinematicManifest.frames.every(
		(frame) =>
			frame.status?.kind === "generated" && Number.isInteger(frame.taskId),
	),
	"all 24 cinematic frames must be traceable generated outputs",
);
assert.ok(
	cinematicManifest.frames.every(
		(frame) => !(frame.file ?? frame.outputFile).includes("fallback-reference"),
	),
	"cinematic manifest must not reference fallback frames",
);

for (const frame of cinematicManifest.frames) {
	const frameFile = frame.file ?? frame.outputFile;
	assert.equal(typeof frameFile, "string");
	assert.equal(typeof frame.caption, "string");
	assert.ok(
		frame.caption.trim().length > 0,
		"cinematic caption must not be empty",
	);
	const framePath = path.join(repoRoot, frameFile);
	assert.ok(existsSync(framePath), `missing cinematic frame: ${frameFile}`);
	const metadata = await sharp(framePath).metadata();
	assert.equal(metadata.format, "webp");
	assert.equal(metadata.width, 3840);
	assert.equal(metadata.height, 1600);
	const publicPath = `/${frameFile.replace(/^public\//, "")}`;
	assert.ok(
		homeConfigSource.includes(publicPath),
		`home config does not reference ${publicPath}`,
	);
	assert.ok(
		homeConfigSource.includes(`caption: ${JSON.stringify(frame.caption)}`),
		`home config does not include caption for ${frameFile}`,
	);
}

assert.match(homeConfigSource, /scrollDistance: 12000/);
assert.match(homeConfigSource, /\/assets\/videos\/artoria-original\.mp4/);
assert.ok(
	existsSync(path.join(repoRoot, "public/assets/videos/artoria-original.mp4")),
);

console.log("Home shutter model checks passed.");
