import assert from "node:assert/strict";
import {
	ENVELOPE_SEQUENCE_FPS,
	ENVELOPE_SEQUENCE_FRAMES,
	getSequenceFrameIndex,
} from "../../src/features/xiao/model/gothic-effect-sequences.ts";

assert.equal(ENVELOPE_SEQUENCE_FPS, 10);
assert.equal(ENVELOPE_SEQUENCE_FRAMES.length, 12);
assert.deepEqual(ENVELOPE_SEQUENCE_FRAMES.at(-1).source, {
	x: 2400,
	y: 360,
	width: 480,
	height: 360,
});
assert.equal(getSequenceFrameIndex(0.4, ENVELOPE_SEQUENCE_FPS, 12, false), 4);
assert.equal(getSequenceFrameIndex(10, ENVELOPE_SEQUENCE_FPS, 12, false), 11);

console.log("Gothic effect sequence checks passed.");
