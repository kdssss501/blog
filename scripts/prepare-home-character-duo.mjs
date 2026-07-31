import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
	throw new Error(
		"usage: node scripts/prepare-home-character-duo.mjs <input> <output>",
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

function isBackgroundCandidate(pixelIndex) {
	const offset = pixelIndex * 4;
	const red = data[offset];
	const green = data[offset + 1];
	const blue = data[offset + 2];
	const alpha = data[offset + 3];
	const darkest = Math.min(red, green, blue);
	const lightest = Math.max(red, green, blue);
	return alpha === 0 || (darkest >= 230 && lightest - darkest <= 18);
}

function enqueue(pixelIndex) {
	if (background[pixelIndex] || !isBackgroundCandidate(pixelIndex)) return;
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

let left = info.width;
let top = info.height;
let right = -1;
let bottom = -1;
let removed = 0;
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
	if (data[offset + 3] === 0) continue;
	const x = pixelIndex % info.width;
	const y = Math.floor(pixelIndex / info.width);
	left = Math.min(left, x);
	top = Math.min(top, y);
	right = Math.max(right, x);
	bottom = Math.max(bottom, y);
}

if (right < left || bottom < top) {
	throw new Error("background removal produced an empty image");
}

const margin = 18;
left = Math.max(0, left - margin);
top = Math.max(0, top - margin);
right = Math.min(info.width - 1, right + margin);
bottom = Math.min(info.height - 1, bottom + margin);

const character = await sharp(data, {
	raw: { width: info.width, height: info.height, channels: 4 },
})
	.extract({
		left,
		top,
		width: right - left + 1,
		height: bottom - top + 1,
	})
	.resize({
		width: 1900,
		height: 1120,
		fit: "inside",
		kernel: sharp.kernel.lanczos3,
	})
	.png({ compressionLevel: 9 })
	.toBuffer({ resolveWithObject: true });

await sharp({
	create: {
		width: 2048,
		height: 1152,
		channels: 4,
		background: { r: 0, g: 0, b: 0, alpha: 0 },
	},
})
	.composite([
		{
			input: character.data,
			left: Math.round((2048 - character.info.width) / 2),
			top: 1152 - character.info.height,
		},
	])
	.png({ compressionLevel: 9 })
	.toFile(output);

console.log(
	JSON.stringify({
		removed,
		sourcePixels: pixelCount,
		bbox: { left, top, right, bottom },
		placed: { width: character.info.width, height: character.info.height },
		output,
	}),
);
