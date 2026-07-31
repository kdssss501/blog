import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
	throw new Error("usage: node scripts/clean-home-character-alpha.mjs <input> <output>");
}

const input = path.resolve(inputArg);
const output = path.resolve(outputArg);
const { data, info } = await sharp(input)
	.ensureAlpha()
	.raw()
	.toBuffer({ resolveWithObject: true });

let removed = 0;
for (let offset = 0; offset < data.length; offset += 4) {
	const red = data[offset];
	const green = data[offset + 1];
	const blue = data[offset + 2];
	const alpha = data[offset + 3];
	const isMagentaKeyResidue =
		alpha > 0 &&
		red > 100 &&
		blue > 70 &&
		green < 120 &&
		red - green > 35 &&
		blue - green > 35;

	if (!isMagentaKeyResidue) continue;
	data[offset] = 0;
	data[offset + 1] = 0;
	data[offset + 2] = 0;
	data[offset + 3] = 0;
	removed += 1;
}

await sharp(data, {
	raw: {
		width: info.width,
		height: info.height,
		channels: 4,
	},
})
	.png({ compressionLevel: 9 })
	.toFile(output);

console.log(`removed ${removed} magenta key pixels`);
