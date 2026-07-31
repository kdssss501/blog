import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	VAMPIRE_INTRO_SESSION_KEY,
} from "../../src/features/xiao/model/vampire-intro-timeline.ts";

assert.equal(VAMPIRE_INTRO_SESSION_KEY, "blog:vampire:intro:v1");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (...segments) => readFileSync(path.join(repoRoot, ...segments), "utf8");
const introSource = read("src/features/xiao/ui/VampireChainIntro.svelte");
const runtimeSource = read("src/features/xiao/client/vampire-yuimi-gate-runtime.ts");

for (const selector of [
	"data-kisara-burst-canvas",
	"data-kisara-energy",
	"data-kisara-title-data",
	"data-kisara-title-lens",
	"data-kisara-space-lens",
	"data-kisara-post-release-canvas",
	"data-kisara-chain-back",
	"data-kisara-chain-front",
]) {
	assert.match(introSource, new RegExp(selector));
}
assert.match(introSource, /VAMPIRE/);
assert.match(introSource, /kisara-scrollbar/);
assert.match(introSource, /kisara:gate-progress/);
assert.match(introSource, /is-released/);
assert.match(introSource, /resolveGateState/);
assert.match(introSource, /data-gate-state/);
assert.match(runtimeSource, /new AbortController\(\)/);
assert.match(runtimeSource, /addEventListener\("wheel"/);
assert.match(runtimeSource, /addEventListener\("keydown"/);
assert.match(runtimeSource, /addEventListener\("touchmove"/);
assert.match(runtimeSource, /CustomEvent\("kisara:gate-progress"/);
assert.match(runtimeSource, /cancelAnimationFrame/);
assert.match(runtimeSource, /is-released/);

console.log("Vampire Yuimi gate checks passed.");
