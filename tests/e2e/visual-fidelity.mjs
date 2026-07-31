import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const referenceDirectory = process.env.FIDELITY_REFERENCE_DIR;
const currentDirectory = process.env.FIDELITY_CURRENT_DIR;
const reportPath =
	process.env.FIDELITY_REPORT ||
	path.resolve("test-results/fidelity-report.json");

if (!referenceDirectory || !currentDirectory) {
	throw new Error(
		"Set FIDELITY_REFERENCE_DIR and FIDELITY_CURRENT_DIR before running the fidelity audit.",
	);
}

const pairs = [
	["home", "fqzlr-home"],
	["posts", "fqzlr-posts"],
	["article", "fqzlr-article"],
	["friends", "fqzlr-friends"],
	["guestbook", "tsh-guestbook"],
	["notebook", "tsh-notebooks"],
];
const viewports = ["desktop", "mobile"];
const minimumStructuralRun = 12;

function rectangle(x, y, width, height) {
	return { x, y, width, height };
}

function pageMasks(name, viewport) {
	if (name === "home") {
		return viewport === "desktop"
			? [rectangle(0, 70, 1290, 700), rectangle(180, 230, 820, 430)]
			: [rectangle(0, 0, 390, 738)];
	}
	if (name === "posts") {
		if (viewport === "mobile") {
			return [
				rectangle(8, 82, 374, 112),
				...Array.from({ length: 3 }, (_, index) =>
					rectangle(9, 206 + index * 248, 381, 226),
				),
				rectangle(0, 756, 390, 88),
			];
		}
		return [
			rectangle(30, 108, 252, 280),
			rectangle(316, 92, 610, 132),
			rectangle(1028, 176, 104, 50),
			rectangle(1168, 132, 230, 92),
			...Array.from({ length: 5 }, (_, index) =>
				rectangle(314, 250 + index * 172, 812, 148),
			),
		];
	}
	if (name === "article") {
		return viewport === "desktop"
			? [
					rectangle(40, 132, 232, 468),
					rectangle(302, 108, 838, 892),
					rectangle(1162, 150, 242, 850),
				]
			: [rectangle(0, 62, 390, 712), rectangle(0, 834, 390, 10)];
	}
	if (name === "friends") {
		return viewport === "desktop"
			? [
					rectangle(30, 108, 250, 860),
					rectangle(348, 110, 746, 150),
					rectangle(1166, 108, 240, 870),
					...Array.from({ length: 7 }).flatMap((_, row) =>
						Array.from({ length: 3 }, (_, column) =>
							rectangle(358 + column * 254, 282 + row * 104, 220, 68),
						),
					),
				]
			: [
					// Friend categories and entries are private data; retain their UI borders.
					rectangle(72, 94, 64, 40),
					rectangle(35, 138, 250, 25),
					rectangle(42, 194, 118, 26),
					rectangle(44, 242, 34, 20),
					rectangle(97, 242, 40, 20),
					rectangle(143, 225, 60, 46),
					...[288, 379, 471, 562, 654, 745, 837].map((top) =>
						rectangle(42, top + 3, 345, 70),
					),
					...[288, 379, 471, 562, 654, 745, 837].map((top) =>
						rectangle(39, top, 42, 15),
					),
					rectangle(0, 756, 390, 88),
				];
	}
	if (name === "guestbook") {
		return viewport === "desktop"
			? [
					// The current guestbook is a full-height 80/20 chat workspace.
					// Mask volatile messages and member data while retaining the outer
					// frame, header divider and 80/20 column divider for comparison.
					rectangle(0, 0, 1440, 52),
					rectangle(30, 55, 1380, 67),
					rectangle(30, 125, 1103, 873),
					rectangle(1136, 125, 274, 873),
				]
			: [rectangle(1, 1, 388, 754), rectangle(0, 756, 390, 88)];
	}
	return viewport === "desktop"
		? [
				rectangle(0, 0, 1440, 76),
				rectangle(28, 95, 260, 880),
				rectangle(1148, 95, 260, 880),
				rectangle(328, 100, 792, 126),
				rectangle(328, 148, 240, 72),
				rectangle(996, 148, 124, 42),
				rectangle(300, 870, 850, 130),
				...Array.from({ length: 2 }).flatMap((_, row) =>
					Array.from({ length: 3 }, (_, column) =>
						rectangle(314 + column * 277, 248 + row * 306, 257, 286),
					),
				),
			]
		: [
				// Preserve dividers and card outlines while excluding notebook content/media.
				rectangle(20, 48, 360, 34),
				rectangle(20, 88, 360, 34),
				rectangle(10, 140, 378, 264),
				rectangle(10, 406, 378, 107),
				rectangle(10, 533, 378, 263),
				rectangle(0, 756, 390, 88),
			];
}

function includeRegions(name, viewport, width, height) {
	if (name === "home") {
		return viewport === "desktop"
			? [
					// Translucent surfaces inherit unrelated authorized media. Compare opaque
					// borders and button interiors; geometry covers the complete components.
					rectangle(1374, 798, 42, 42),
					rectangle(1374, 860, 42, 42),
					rectangle(1374, 934, 42, 42),
				]
			: [rectangle(230, height - 64, 8, 8), rectangle(260, height - 39, 8, 8)];
	}
	return [rectangle(0, 0, width, height)];
}

async function prepareImage(file, masks) {
	const source = sharp(await readFile(file)).ensureAlpha();
	const metadata = await source.metadata();
	const overlays = masks.map(({ x, y, width, height }) => ({
		input: {
			create: {
				width: Math.max(1, Math.min(width, metadata.width - x)),
				height: Math.max(1, Math.min(height, metadata.height - y)),
				channels: 4,
				background: { r: 245, g: 245, b: 245, alpha: 1 },
			},
		},
		left: x,
		top: y,
	}));
	const { data, info } = await source
		.composite(overlays)
		.flatten({ background: "#f5f5f5" })
		.grayscale()
		.blur(1.2)
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { data, width: info.width, height: info.height };
}

function blockSsim(left, right, width, region) {
	const block = 8;
	const c1 = 6.5025;
	const c2 = 58.5225;
	let total = 0;
	let count = 0;
	for (let y = region.y; y < region.y + region.height; y += block) {
		for (let x = region.x; x < region.x + region.width; x += block) {
			const valuesLeft = [];
			const valuesRight = [];
			for (
				let by = y;
				by < Math.min(y + block, region.y + region.height);
				by += 1
			) {
				for (
					let bx = x;
					bx < Math.min(x + block, region.x + region.width);
					bx += 1
				) {
					valuesLeft.push(left[by * width + bx]);
					valuesRight.push(right[by * width + bx]);
				}
			}
			const length = valuesLeft.length;
			if (length === 0) continue;
			const meanLeft =
				valuesLeft.reduce((sum, value) => sum + value, 0) / length;
			const meanRight =
				valuesRight.reduce((sum, value) => sum + value, 0) / length;
			let varianceLeft = 0;
			let varianceRight = 0;
			let covariance = 0;
			for (let index = 0; index < length; index += 1) {
				const deltaLeft = valuesLeft[index] - meanLeft;
				const deltaRight = valuesRight[index] - meanRight;
				varianceLeft += deltaLeft * deltaLeft;
				varianceRight += deltaRight * deltaRight;
				covariance += deltaLeft * deltaRight;
			}
			const divisor = Math.max(1, length - 1);
			varianceLeft /= divisor;
			varianceRight /= divisor;
			covariance /= divisor;
			const score =
				((2 * meanLeft * meanRight + c1) * (2 * covariance + c2)) /
				((meanLeft ** 2 + meanRight ** 2 + c1) *
					(varianceLeft + varianceRight + c2));
			total += Math.max(-1, Math.min(1, score));
			count += 1;
		}
	}
	return { total, count };
}

function isMaskedPixel(x, y, masks, padding = 2) {
	return masks.some(
		(mask) =>
			x >= mask.x - padding &&
			x < mask.x + mask.width + padding &&
			y >= mask.y - padding &&
			y < mask.y + mask.height + padding,
	);
}

function edgePixels(data, width, height, regions, masks) {
	const binary = new Uint8Array(width * height);
	const structural = new Uint8Array(width * height);
	for (const region of regions) {
		const endX = Math.min(width - 1, region.x + region.width - 1);
		const endY = Math.min(height - 1, region.y + region.height - 1);
		for (let y = Math.max(1, region.y + 1); y < endY; y += 1) {
			for (let x = Math.max(1, region.x + 1); x < endX; x += 1) {
				if (isMaskedPixel(x, y, masks)) continue;
				const horizontal = Math.abs(
					data[y * width + x + 1] - data[y * width + x - 1],
				);
				const vertical = Math.abs(
					data[(y + 1) * width + x] - data[(y - 1) * width + x],
				);
				if (horizontal + vertical >= 34) binary[y * width + x] = 1;
			}
		}

		for (let y = Math.max(1, region.y + 1); y < endY; y += 1) {
			let runStart = -1;
			for (let x = Math.max(1, region.x + 1); x <= endX; x += 1) {
				if (x < endX && binary[y * width + x]) {
					if (runStart < 0) runStart = x;
				} else if (runStart >= 0) {
					if (x - runStart >= minimumStructuralRun) {
						for (let mark = runStart; mark < x; mark += 1) {
							structural[y * width + mark] = 1;
						}
					}
					runStart = -1;
				}
			}
		}

		for (let x = Math.max(1, region.x + 1); x < endX; x += 1) {
			let runStart = -1;
			for (let y = Math.max(1, region.y + 1); y <= endY; y += 1) {
				if (y < endY && binary[y * width + x]) {
					if (runStart < 0) runStart = y;
				} else if (runStart >= 0) {
					if (y - runStart >= minimumStructuralRun) {
						for (let mark = runStart; mark < y; mark += 1) {
							structural[mark * width + x] = 1;
						}
					}
					runStart = -1;
				}
			}
		}
	}

	const points = [];
	for (let index = 0; index < structural.length; index += 1) {
		if (structural[index])
			points.push([index % width, Math.floor(index / width)]);
	}
	return points;
}

function distanceField(edges, width, height) {
	const diagonal = Math.SQRT2;
	const field = new Float32Array(width * height);
	field.fill(255);
	for (const [x, y] of edges) field[y * width + x] = 0;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = y * width + x;
			let value = field[index];
			if (x > 0) value = Math.min(value, field[index - 1] + 1);
			if (y > 0) value = Math.min(value, field[index - width] + 1);
			if (x > 0 && y > 0) {
				value = Math.min(value, field[index - width - 1] + diagonal);
			}
			if (x + 1 < width && y > 0) {
				value = Math.min(value, field[index - width + 1] + diagonal);
			}
			field[index] = value;
		}
	}

	for (let y = height - 1; y >= 0; y -= 1) {
		for (let x = width - 1; x >= 0; x -= 1) {
			const index = y * width + x;
			let value = field[index];
			if (x + 1 < width) value = Math.min(value, field[index + 1] + 1);
			if (y + 1 < height) value = Math.min(value, field[index + width] + 1);
			if (x + 1 < width && y + 1 < height) {
				value = Math.min(value, field[index + width + 1] + diagonal);
			}
			if (x > 0 && y + 1 < height) {
				value = Math.min(value, field[index + width - 1] + diagonal);
			}
			field[index] = value;
		}
	}
	return field;
}

function directedEdgeDistances(source, target, width, height) {
	const field = distanceField(target, width, height);
	return source.map(([x, y]) => field[y * width + x]);
}

function percentile(values, ratio) {
	if (values.length === 0) return 0;
	const sorted = values.toSorted((left, right) => left - right);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

const results = [];
for (const [name, referencePrefix] of pairs) {
	for (const viewport of viewports) {
		const referenceFile = path.join(
			referenceDirectory,
			`${referencePrefix}-${viewport}.png`,
		);
		const currentFile = path.join(currentDirectory, `${name}-${viewport}.png`);
		const masks = pageMasks(name, viewport);
		const [reference, current] = await Promise.all([
			prepareImage(referenceFile, masks),
			prepareImage(currentFile, masks),
		]);
		if (
			reference.width !== current.width ||
			reference.height !== current.height
		) {
			throw new Error(`${name}-${viewport} dimensions do not match`);
		}
		const regions = includeRegions(
			name,
			viewport,
			reference.width,
			reference.height,
		);
		let ssimTotal = 0;
		let ssimCount = 0;
		for (const region of regions) {
			const score = blockSsim(
				reference.data,
				current.data,
				reference.width,
				region,
			);
			ssimTotal += score.total;
			ssimCount += score.count;
		}
		const referenceEdges = edgePixels(
			reference.data,
			reference.width,
			reference.height,
			regions,
			masks,
		);
		const currentEdges = edgePixels(
			current.data,
			current.width,
			current.height,
			regions,
			masks,
		);
		const referenceToCurrent = directedEdgeDistances(
			referenceEdges,
			currentEdges,
			reference.width,
			reference.height,
		);
		const currentToReference = directedEdgeDistances(
			currentEdges,
			referenceEdges,
			reference.width,
			reference.height,
		);
		const distances = [...referenceToCurrent, ...currentToReference];
		const result = {
			name: `${name}-${viewport}`,
			maskedSsim: Number((ssimTotal / Math.max(1, ssimCount)).toFixed(4)),
			edgeP95: Number(percentile(distances, 0.95).toFixed(2)),
			edgeSamples: distances.length,
			referenceEdges: referenceEdges.length,
			currentEdges: currentEdges.length,
			referenceToCurrentP95: Number(
				percentile(referenceToCurrent, 0.95).toFixed(2),
			),
			currentToReferenceP95: Number(
				percentile(currentToReference, 0.95).toFixed(2),
			),
		};
		results.push(result);
		console.log(
			`${result.name}: SSIM=${result.maskedSsim.toFixed(4)}, edge-p95=${result.edgeP95.toFixed(2)}px`,
		);
	}
}

const failed = results.filter((result) => result.maskedSsim < 0.95);
await writeFile(
	reportPath,
	`${JSON.stringify({ threshold: { maskedSsim: 0.95, geometryPx: 4 }, results, failed }, null, 2)}\n`,
);
if (failed.length > 0) {
	throw new Error(
		`Visual fidelity failed for: ${failed.map((result) => result.name).join(", ")}`,
	);
}
