import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const assetPath = path.join(
	repoRoot,
	"public/assets/images/home/saber-gilgamesh-pixel.png",
);

assert.equal(
	existsSync(assetPath),
	true,
	"missing Saber and Gilgamesh hero asset",
);

const image = sharp(assetPath);
const metadata = await image.metadata();
assert.equal(metadata.format, "png");
assert.equal(metadata.width, 2048);
assert.equal(metadata.height, 1152);
assert.equal(metadata.hasAlpha, true, "hero character PNG must retain alpha");

const alpha = await image.ensureAlpha().extractChannel("alpha").stats();
assert.equal(alpha.channels[0].min, 0, "PNG must contain transparent pixels");
assert.equal(
	alpha.channels[0].max,
	255,
	"PNG must contain opaque character pixels",
);

const heroSource = readFileSync(
	path.join(repoRoot, "src/features/home/ui/HomeHero.astro"),
	"utf8",
);
assert.match(heroSource, /id="home-hero-character-duo"/);
assert.match(heroSource, /class="home-hero__speech-accent"/);
assert.match(heroSource, /const CHARACTER_FOLLOW_MAX_X = 26;/);
assert.match(heroSource, /const CHARACTER_FOLLOW_MAX_Y = 18;/);
assert.match(heroSource, /const CHARACTER_FOLLOW_LERP = 0\.09;/);
assert.match(
	heroSource,
	/window\.addEventListener\("pointermove", handlePointerMove/,
);
assert.doesNotMatch(heroSource, /<canvas[^>]+pixel-saber/i);

const homeConfigSource = readFileSync(
	path.join(repoRoot, "src/config/homeConfig.ts"),
	"utf8",
);
assert.match(
	homeConfigSource,
	/avatarOnWork:\s*"\/assets\/images\/home\/avatar-work-on\.gif"/,
);
assert.match(
	homeConfigSource,
	/avatarOffWork:\s*"assets\/images\/avatar-work-off\.webp"/,
);
assert.match(
	homeConfigSource,
	/speechAccentImage:\s*"\/assets\/images\/home\/home2-1\.webp"/,
);

const onWorkMetadata = await sharp(
	path.join(repoRoot, "public/assets/images/home/avatar-work-on.gif"),
	{ animated: true },
).metadata();
assert.equal(onWorkMetadata.format, "gif");
assert.equal(onWorkMetadata.width, 300);
assert.equal(onWorkMetadata.pageHeight, 300);
assert.equal(
	onWorkMetadata.pages,
	38,
	"on-work avatar must retain every GIF frame",
);
assert.equal(onWorkMetadata.loop, 0, "on-work avatar must loop continuously");

const homeHeroCss = readFileSync(
	path.join(repoRoot, "src/styles/components/home-hero.css"),
	"utf8",
);
assert.match(
	homeHeroCss,
	/\.home-hero__avatar\s*{[^}]*display:\s*block;[^}]*object-fit:\s*cover;/s,
);
assert.match(
	homeHeroCss,
	/\.home-hero__avatar-group \.home-hero__avatar-wrapper\s*{[^}]*border:\s*0;[^}]*background:\s*transparent;/s,
);

const offWorkMetadata = await sharp(
	path.join(repoRoot, "src/assets/images/avatar-work-off.webp"),
	{ animated: true },
).metadata();
assert.ok(
	(offWorkMetadata.pages ?? 1) > 1,
	"off-work Phoebe avatar must stay animated",
);
assert.equal(
	offWorkMetadata.loop,
	0,
	"off-work Phoebe avatar must loop continuously",
);

const speechAccentMetadata = await sharp(
	path.join(repoRoot, "public/assets/images/home/home2-1.webp"),
	{ animated: true },
).metadata();
assert.ok(
	(speechAccentMetadata.pages ?? 1) > 1,
	"speech accent must stay animated",
);
assert.equal(
	speechAccentMetadata.loop,
	0,
	"speech accent must loop continuously",
);

const heroStyles = readFileSync(
	path.join(repoRoot, "src/styles/components/home-hero.css"),
	"utf8",
);
assert.match(
	heroStyles,
	/\.home-hero__character-duo img\s*\{[^}]*opacity:\s*0\.82/s,
);
assert.match(
	heroStyles,
	/\.home-hero__character-duo img\s*\{[^}]*filter:\s*none/s,
);
assert.doesNotMatch(
	heroStyles,
	/\.home-hero__character-duo img\s*\{[^}]*filter:[^}]*blur/s,
);
assert.match(
	heroStyles,
	/\.home-hero__character-duo\s*\{[^}]*translate:\s*var\(--home-character-follow-x\) var\(--home-character-follow-y\)/s,
);
assert.match(
	heroStyles,
	/\.home-hero__character-duo\s*\{[^}]*width:\s*clamp\(22\.6667rem, 26vw, 29\.3333rem\)/s,
);
assert.equal(
	existsSync(path.join(repoRoot, "src/features/pixel-saber/index.ts")),
	false,
	"legacy PixelSaber canvas feature must stay removed",
);

console.log("home character asset tests passed");
