import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [inputArg, outputArg, keyArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
	throw new Error(
		"usage: node scripts/clean-workbench-chroma-alpha.mjs <input> <output> [r,g,b]",
	);
}

const input = path.resolve(inputArg);
const output = path.resolve(outputArg);
const { data, info } = await sharp(input)
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });

const pixelCount = info.width * info.height;
const background = new Uint8Array(pixelCount);
const queue = new Int32Array(pixelCount);
let queueStart = 0;
let queueEnd = 0;

function median(values) {
	values.sort((a, b) => a - b);
	return values[Math.floor(values.length / 2)];
}

const borderRed = [];
const borderGreen = [];
const borderBlue = [];
function sample(pixelIndex) {
	const offset = pixelIndex * 4;
	borderRed.push(data[offset]);
	borderGreen.push(data[offset + 1]);
	borderBlue.push(data[offset + 2]);
}

const sampleStep = Math.max(1, Math.floor(Math.min(info.width, info.height) / 512));
for (let x = 0; x < info.width; x += sampleStep) {
	sample(x);
	sample((info.height - 1) * info.width + x);
}
for (let y = 0; y < info.height; y += sampleStep) {
	sample(y * info.width);
	sample(y * info.width + info.width - 1);
}

const explicitKey = keyArg
	?.split(",")
	.map((value) => Number.parseInt(value, 10));
if (
	explicitKey &&
	(explicitKey.length !== 3 ||
		explicitKey.some((value) => !Number.isInteger(value) || value < 0 || value > 255))
) {
	throw new Error("explicit key must be r,g,b with channels from 0 to 255");
}
const key = explicitKey
	? { r: explicitKey[0], g: explicitKey[1], b: explicitKey[2] }
	: {
			r: median(borderRed),
			g: median(borderGreen),
			b: median(borderBlue),
		};

const keyMode =
	key.g > key.r + 70 && key.g > key.b + 70
		? "green"
		: Math.min(key.r, key.b) > key.g + 65
			? "magenta"
			: "distance";

function keyDistance(pixelIndex) {
	const offset = pixelIndex * 4;
	const redDelta = data[offset] - key.r;
	const greenDelta = data[offset + 1] - key.g;
	const blueDelta = data[offset + 2] - key.b;
	return Math.sqrt(
		redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta,
	);
}

function isConnectedKey(pixelIndex) {
	const offset = pixelIndex * 4;
	const red = data[offset];
	const green = data[offset + 1];
	const blue = data[offset + 2];
	const magentaDominance = Math.min(red, blue) - green;
	const greenDominance = green - Math.max(red, blue);
	const distance = keyDistance(pixelIndex);
	return (
		data[offset + 3] === 0 ||
		(keyMode === "magenta" &&
			red > 120 &&
			blue > 100 &&
			magentaDominance > 65 &&
			distance <= 92) ||
		(keyMode === "green" &&
			green > 120 &&
			greenDominance > 55 &&
			distance <= 118) ||
		(keyMode === "distance" && distance <= 42)
	);
}

function enqueue(pixelIndex) {
	if (background[pixelIndex] || !isConnectedKey(pixelIndex)) return;
	background[pixelIndex] = 1;
	queue[queueEnd] = pixelIndex;
	queueEnd += 1;
}

for (let x = 0; x < info.width; x += 1) {
	enqueue(x);
	enqueue((info.height - 1) * info.width + x);
}
for (let y = 0; y < info.height; y += 1) {
	enqueue(y * info.width);
	enqueue(y * info.width + info.width - 1);
}

while (queueStart < queueEnd) {
	const pixelIndex = queue[queueStart];
	queueStart += 1;
	const x = pixelIndex % info.width;
	const y = Math.floor(pixelIndex / info.width);
	if (x > 0) enqueue(pixelIndex - 1);
	if (x + 1 < info.width) enqueue(pixelIndex + 1);
	if (y > 0) enqueue(pixelIndex - info.width);
	if (y + 1 < info.height) enqueue(pixelIndex + info.width);
	if (x > 0 && y > 0) enqueue(pixelIndex - info.width - 1);
	if (x + 1 < info.width && y > 0) enqueue(pixelIndex - info.width + 1);
	if (x > 0 && y + 1 < info.height) enqueue(pixelIndex + info.width - 1);
	if (x + 1 < info.width && y + 1 < info.height) {
		enqueue(pixelIndex + info.width + 1);
	}
}

// Clear near-exact key islands enclosed by loops of hair or fabric.
const islandThreshold = explicitKey ? 82 : 38;
for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
	if (!background[pixelIndex] && keyDistance(pixelIndex) <= islandThreshold) {
		background[pixelIndex] = 1;
	}
}

const edge = new Uint8Array(pixelCount);
for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
	if (!background[pixelIndex]) continue;
	const x = pixelIndex % info.width;
	const y = Math.floor(pixelIndex / info.width);
	if (x > 0) edge[pixelIndex - 1] = 1;
	if (x + 1 < info.width) edge[pixelIndex + 1] = 1;
	if (y > 0) edge[pixelIndex - info.width] = 1;
	if (y + 1 < info.height) edge[pixelIndex + info.width] = 1;
}

let removed = 0;
let feathered = 0;
let despilled = 0;
for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
	const offset = pixelIndex * 4;
	if (background[pixelIndex]) {
		data[offset] = 0;
		data[offset + 1] = 0;
		data[offset + 2] = 0;
		data[offset + 3] = 0;
		removed += 1;
		continue;
	}
	if (!edge[pixelIndex]) continue;
	const distance = keyDistance(pixelIndex);
	if (distance >= 150) continue;
	const alpha = Math.max(0, Math.min(255, Math.round(((distance - 78) / 72) * 255)));
	if (alpha >= 255) continue;
	data[offset + 3] = Math.min(data[offset + 3], alpha);
	if (keyMode === "green") {
		const neutralGreen = Math.max(data[offset], data[offset + 2]);
		data[offset + 1] = Math.min(data[offset + 1], neutralGreen);
	}
	feathered += 1;
}

if (keyMode === "green") {
	for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
		const offset = pixelIndex * 4;
		if (data[offset + 3] === 0) continue;
		const neutralGreen = Math.max(data[offset], data[offset + 2]);
		const greenDominance = data[offset + 1] - neutralGreen;
		if (greenDominance <= 8) continue;
		const sourceGreen = data[offset + 1];
		data[offset + 1] = neutralGreen;
		if (neutralGreen < 64 && sourceGreen > 72) {
			const retention = Math.max(
				0,
				Math.min(1, (neutralGreen + 12) / (sourceGreen + 12)),
			);
			data[offset + 3] = Math.round(data[offset + 3] * retention);
		}
		despilled += 1;
	}
}

await sharp(data, {
	raw: { width: info.width, height: info.height, channels: 4 },
})
	.png({ compressionLevel: 9 })
	.toFile(output);

console.log(
	JSON.stringify({
		key,
		keyMode,
		removed,
		feathered,
		despilled,
		total: pixelCount,
		output,
	}),
);
