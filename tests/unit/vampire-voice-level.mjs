import assert from "node:assert/strict";
import { normalizeVoiceRms } from "../../src/features/xiao/client/vampire-voice-player.ts";

assert.equal(normalizeVoiceRms(0), 0);
assert.equal(normalizeVoiceRms(0.006), 0);
assert.ok(normalizeVoiceRms(0.02) > 0.3);
assert.ok(normalizeVoiceRms(0.04) > 0.65);
assert.equal(normalizeVoiceRms(1), 1);
assert.equal(normalizeVoiceRms(Number.NaN), 0);

console.log("Vampire voice level checks passed.");
