import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	getVampireChibiFrameIndex,
	VAMPIRE_CHIBI_ATLAS_COLUMNS,
	VAMPIRE_CHIBI_FRAME_COUNT,
	VAMPIRE_CHIBI_FRAME_DELAY_MS,
	VAMPIRE_CHIBI_FRAME_SIZE,
} from "../../src/features/xiao/model/vampire-chibi-timeline.ts";

assert.equal(VAMPIRE_CHIBI_FRAME_COUNT, 16);
assert.equal(VAMPIRE_CHIBI_FRAME_DELAY_MS, 90);
assert.equal(VAMPIRE_CHIBI_ATLAS_COLUMNS, 4);
assert.equal(VAMPIRE_CHIBI_FRAME_SIZE, 384);
assert.equal(getVampireChibiFrameIndex(0), 0);
assert.equal(getVampireChibiFrameIndex(89), 0);
assert.equal(getVampireChibiFrameIndex(90), 1);
assert.equal(getVampireChibiFrameIndex(1_440), 0);
assert.equal(getVampireChibiFrameIndex(Number.NaN), 0);

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const reactionSource = readFileSync(
	path.join(repoRoot, "src/features/xiao/ui/VampireChibiReaction.svelte"),
	"utf8",
);
const generatorSource = readFileSync(
	path.join(repoRoot, "scripts/generate-vampire-chibi-atlases.mjs"),
	"utf8",
);
assert.match(reactionSource, /-atlas\.webp/);
assert.match(reactionSource, /data-animation="chat-edge-drop"/);
assert.match(reactionSource, /@keyframes chibi-chat-drop/);
assert.match(reactionSource, /--chibi-landing-x/);
assert.doesNotMatch(reactionSource, /pivot|staff/i);
assert.doesNotMatch(generatorSource, /createPivotStaffLayer|swingAngles|maxSwingDegrees/);
for (const variant of ["black", "white"]) {
	for (const expression of ["happy", "shy", "startled"]) {
		assert.ok(
			existsSync(
				path.join(
					repoRoot,
					"public/assets/images/xiao/vampire-chibi",
					variant,
					`${expression}-atlas.webp`,
				),
			),
			`missing chat-reaction atlas: ${variant}/${expression}`,
		);
	}
}

console.log("Vampire chibi timeline checks passed.");
