import assert from "node:assert/strict";
import {
	extractUpstreamUrl,
	parseGatewayPort,
	parseArguments,
	resolveServiceToken,
} from "../../scripts/tts-online.mjs";

assert.deepEqual(parseArguments([]), { dryRun: false, help: false });
assert.deepEqual(parseArguments(["--dry-run"]), { dryRun: true, help: false });
assert.deepEqual(parseArguments(["--help"]), { dryRun: false, help: true });
assert.throws(() => parseArguments(["--unknown"]), /不支持的参数/u);

assert.equal(
	extractUpstreamUrl("TTS_UPSTREAM_URL=https://violet-fog.trycloudflare.com"),
	"https://violet-fog.trycloudflare.com",
);
assert.equal(extractUpstreamUrl("[Tunnel] connected"), null);

assert.equal(parseGatewayPort("8788"), 8788);
assert.throws(() => parseGatewayPort("0"), /TTS_GATEWAY_PORT/u);
assert.throws(() => parseGatewayPort("not-a-port"), /TTS_GATEWAY_PORT/u);

const configured = resolveServiceToken({
	TTS_SERVICE_TOKEN: `\uFEFF${"x".repeat(32)}`,
});
assert.equal(configured.generated, false);
assert.equal(configured.token, "x".repeat(32));

const malformed = resolveServiceToken({
	TTS_SERVICE_TOKEN: "x".repeat(31) + " ",
});
assert.equal(malformed.generated, true);

const generated = resolveServiceToken({ TTS_SERVICE_TOKEN: "short" });
assert.equal(generated.generated, true);
assert.match(generated.token, /^[a-f0-9]{64}$/u);

console.log("TTS online launcher checks passed.");
