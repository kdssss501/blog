import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
	throw new Error(
		"usage: node scripts/clean-checkerboard-alpha.mjs <input> <output>",
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

function isCheckerboard(pixelIndex) {
	const offset = pixelIndex * 4;
	const red = data[offset];
	const green = data[offset + 1];
	const blue = data[offset + 2];
	return (
		Math.min(red, green, blue) >= 226 &&
		Math.max(red, green, blue) - Math.min(red, green, blue) <= 18
	);
}

function enqueue(pixelIndex) {
	if (background[pixelIndex] || !isCheckerboard(pixelIndex)) return;
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

// The ornamental frame encloses a second checkerboard component.
enqueue(
	Math.floor(info.height * 0.5) * info.width + Math.floor(info.width * 0.5),
);

while (queueStart < queueEnd) {
	const pixelIndex = queue[queueStart];
	queueStart += 1;
	const x = pixelIndex % info.width;
	const y = Math.floor(pixelIndex / info.width);
	if (x > 0) enqueue(pixelIndex - 1);
	if (x + 1 < info.width) enqueue(pixelIndex + 1);
	if (y > 0) enqueue(pixelIndex - info.width);
	if (y + 1 < info.height) enqueue(pixelIndex + info.width);
}

let removed = 0;
for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
	if (!background[pixelIndex]) continue;
	const offset = pixelIndex * 4;
	data[offset] = 0;
	data[offset + 1] = 0;
	data[offset + 2] = 0;
	data[offset + 3] = 0;
	removed += 1;
}

await sharp(data, {
	raw: { width: info.width, height: info.height, channels: 4 },
})
	.png({ compressionLevel: 9 })
	.toFile(output);

console.log(JSON.stringify({ input, output, removed, total: pixelCount }));
