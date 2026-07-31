import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const assetRoot = path.join(
	root,
	"public",
	"assets",
	"images",
	"xiao",
	"vampire-gothic",
);
const envelopeSource = path.join(assetRoot, "envelope-effects-atlas-4k.png");
const envelopeOutput = path.join(assetRoot, "envelope-sequence-atlas.png");

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function extractTrimmed(source, region) {
	const cropped = await sharp(source).extract(region).png().toBuffer();
	const trimmed = await sharp(cropped)
		.trim({ background: TRANSPARENT })
		.png()
		.toBuffer();
	return trimmed;
}

async function fitFrame(
	input,
	frameWidth,
	frameHeight,
	{ width, height, rotate = 0, topOffset = 0 } = {},
) {
	const resized = sharp(input)
		.ensureAlpha()
		.resize({
			width: width ?? frameWidth,
			height: height ?? frameHeight,
			fit: "contain",
			background: TRANSPARENT,
			withoutEnlargement: false,
		});
	const rendered =
		rotate === 0
			? resized
			: resized.rotate(rotate, { background: TRANSPARENT });
	const { info } = await rendered.ensureAlpha().toBuffer({
		resolveWithObject: true,
	});
	return {
		input: await rendered.png().toBuffer(),
		left: Math.round((frameWidth - info.width) / 2),
		top: Math.round((frameHeight - info.height) / 2 + topOffset),
	};
}

async function buildEnvelopeSequence() {
	const [closed, open, sparkle] = await Promise.all([
		extractTrimmed(envelopeSource, {
			left: 80,
			top: 100,
			width: 1260,
			height: 900,
		}),
		extractTrimmed(envelopeSource, {
			left: 1640,
			top: 0,
			width: 1200,
			height: 1080,
		}),
		extractTrimmed(envelopeSource, {
			left: 1180,
			top: 2020,
			width: 760,
			height: 760,
		}),
	]);
	const frameWidth = 480;
	const frameHeight = 360;
	const frames = [];
	for (let index = 0; index < 12; index += 1) {
		const opening = index >= 6;
		const base = await fitFrame(
			opening ? open : closed,
			frameWidth,
			frameHeight,
			opening
				? {
						width: 400 + (index - 6) * 8,
						height: 340,
						rotate: (index - 8.5) * 0.6,
						topOffset: -5,
					}
				: {
						width: 390 + index * 9,
						height: 300 + index * 4,
						rotate: (index - 2.5) * 0.7,
					},
		);
		const overlays = [{ input: base.input, left: base.left, top: base.top }];
		if (index >= 4) {
			const sparkleSize = 88 + Math.abs(7 - index) * 7;
			const flash = await fitFrame(sparkle, frameWidth, frameHeight, {
				width: sparkleSize,
				height: sparkleSize,
				rotate: index * 7,
				topOffset: opening ? -42 : 5,
			});
			overlays.push({
				input: flash.input,
				left: flash.left + (opening ? 116 : 92),
				top: flash.top - 42,
			});
		}
		frames.push(
			await sharp({
				create: {
					width: frameWidth,
					height: frameHeight,
					channels: 4,
					background: TRANSPARENT,
				},
			})
				.composite(overlays)
				.png()
				.toBuffer(),
		);
	}
	await mkdir(assetRoot, { recursive: true });
	await sharp({
		create: {
			width: frameWidth * 6,
			height: frameHeight * 2,
			channels: 4,
			background: TRANSPARENT,
		},
	})
		.composite(
			frames.map((input, index) => ({
				input,
				left: (index % 6) * frameWidth,
				top: Math.floor(index / 6) * frameHeight,
			})),
		)
		.png({ compressionLevel: 9 })
		.toFile(envelopeOutput);
}

await mkdir(assetRoot, { recursive: true });
await buildEnvelopeSequence();
console.log(
	JSON.stringify(
		{
			envelope: {
				path: path.relative(root, envelopeOutput).replaceAll("\\", "/"),
				frames: 12,
				fps: 10,
				frame: { width: 480, height: 360, columns: 6 },
			},
		},
		null,
		2,
	),
);
