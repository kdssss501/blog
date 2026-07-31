import {
	ENVELOPE_SEQUENCE_FPS,
	ENVELOPE_SEQUENCE_FRAMES,
	getSequenceFrameIndex,
} from "../model/gothic-effect-sequences";
import {
	CAMERA_PRESETS,
	type VampireCameraMode,
	type VampireCameraState,
} from "./camera-rig";

export type { VampireCameraMode, VampireCameraState } from "./camera-rig";

export interface GothicStageCanvasController {
	setCamera(
		mode: VampireCameraMode,
		transition?: "smooth" | "cut",
	): VampireCameraState;
	setEffectsEnabled(enabled: boolean): void;
	spawnEnvelopeFlight(): void;
	burst(clientX: number, clientY: number): void;
	getState(): VampireCameraState & {
		effectsEnabled: boolean;
	};
	/** 指针离开舞台后返回 null，让 SoulLink 恢复自主视线。 */
	getPointerNormalized(): { x: number; y: number; pressed: boolean } | null;
	destroy(): void;
}

interface GothicStageCanvasOptions {
	backdrop: HTMLCanvasElement;
	effects: HTMLCanvasElement;
	container: HTMLElement;
	backgroundUrl: string;
	effectsAtlasUrl: string;
	envelopeSequenceAtlasUrl: string;
	onCameraChange?: (state: VampireCameraState) => void;
}

interface BurstParticle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	size: number;
}

interface EffectStamp {
	x: number;
	y: number;
	life: number;
	maxLife: number;
	size: number;
	rotation: number;
	sprite: "ring" | "sparkle";
}

interface EnvelopeFlight {
	age: number;
	duration: number;
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	reduced: boolean;
}

const EFFECT_SPRITES = {
	ring: { x: 860, y: 900, width: 960, height: 1100 },
	sparkle: { x: 1130, y: 1900, width: 720, height: 900 },
} as const;

const REDUCED_ENVELOPE_DURATION = 0.46;
const ENVELOPE_SEQUENCE_DURATION =
	ENVELOPE_SEQUENCE_FRAMES.length / ENVELOPE_SEQUENCE_FPS;

// 平滑过渡：easeInOutCubic 比线性 lerp 更有质感
function easeInOutCubic(t: number) {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function loadImage(url: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.decoding = "async";
		image.onload = () => resolve(image);
		image.onerror = () =>
			reject(new Error(`Failed to load stage asset: ${url}`));
		image.src = url;
	});
}

function lerp(current: number, target: number, amount: number) {
	return current + (target - current) * amount;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function resizeCanvas(
	canvas: HTMLCanvasElement,
	width: number,
	height: number,
) {
	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	const pixelWidth = Math.max(1, Math.round(width * ratio));
	const pixelHeight = Math.max(1, Math.round(height * ratio));
	if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
		canvas.width = pixelWidth;
		canvas.height = pixelHeight;
	}
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	const context = canvas.getContext("2d");
	context?.setTransform(ratio, 0, 0, ratio, 0, 0);
	return context;
}

export function mountGothicStageCanvas({
	backdrop,
	effects,
	container,
	backgroundUrl,
	effectsAtlasUrl,
	envelopeSequenceAtlasUrl,
	onCameraChange,
}: GothicStageCanvasOptions): GothicStageCanvasController {
	let background: HTMLImageElement | null = null;
	let effectsAtlas: HTMLImageElement | null = null;
	let envelopeSequenceAtlas: HTMLImageElement | null = null;
	let destroyed = false;
	let frame = 0;
	let effectsEnabled = true;
	let lastTime = performance.now();
	let pointerX = 0;
	let pointerY = 0;
	let pointerActive = false;
	let pointerPressed = false;
	let reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	let camera = { ...CAMERA_PRESETS.wide };
	let targetCamera = { ...CAMERA_PRESETS.wide };
	// 过渡动画状态：记录起始值和进度，用于 easeInOutCubic
	let transitionFrom = { ...CAMERA_PRESETS.wide };
	let transitionProgress = 1; // 1 = 到位，< 1 = 过渡中
	let transitionDuration = 0.65; // seconds
	const particles: BurstParticle[] = [];
	const stamps: EffectStamp[] = [];
	let envelopeFlight: EnvelopeFlight | null = null;
	const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

	const updateCanvasSize = () => {
		const { width, height } = container.getBoundingClientRect();
		resizeCanvas(backdrop, width, height);
		resizeCanvas(effects, width, height);
	};

	const drawBackdrop = (time: number) => {
		const context = backdrop.getContext("2d");
		if (!context) return;
		const width = backdrop.clientWidth;
		const height = backdrop.clientHeight;
		context.clearRect(0, 0, width, height);
		// 实际背景由 SSR <img> 提供；该画布只保留透明氛围层。
		if (!background) return;

		const drift =
			reducedMotion || !effectsEnabled ? 0 : Math.sin(time / 8500) * 0.004;
		const scale =
			Math.min(
				width / background.naturalWidth,
				height / background.naturalHeight,
			) *
			(1 + drift);
		const drawWidth = background.naturalWidth * scale;
		const drawHeight = background.naturalHeight * scale;
		const parallaxX = effectsEnabled && !reducedMotion ? pointerX * 2 : 0;
		const parallaxY = effectsEnabled && !reducedMotion ? pointerY * 2 : 0;
		const x = (width - drawWidth) / 2 + parallaxX;
		const y = (height - drawHeight) / 2 + parallaxY;
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";
		context.globalAlpha = 0;
		context.drawImage(background, x, y, drawWidth, drawHeight);
		context.globalAlpha = 1;

		const vignette = context.createRadialGradient(
			width * 0.45,
			height * 0.44,
			Math.min(width, height) * 0.2,
			width * 0.5,
			height * 0.5,
			Math.max(width, height) * 0.72,
		);
		vignette.addColorStop(0, "rgb(0 0 0 / 0%)");
		vignette.addColorStop(1, "rgb(0 0 0 / 38%)");
		context.fillStyle = vignette;
		context.fillRect(0, 0, width, height);
	};

	const drawEffects = (delta: number) => {
		const context = effects.getContext("2d");
		if (!context) return;
		const width = effects.clientWidth;
		const height = effects.clientHeight;
		context.clearRect(0, 0, width, height);

		for (let index = stamps.length - 1; index >= 0; index -= 1) {
			const stamp = stamps[index];
			if (!reducedMotion && effectsEnabled) stamp.life -= delta;
			if (stamp.life <= 0) {
				stamps.splice(index, 1);
				continue;
			}
			if (!effectsAtlas) continue;
			const source = EFFECT_SPRITES[stamp.sprite];
			const progress = 1 - stamp.life / stamp.maxLife;
			const alpha = Math.sin(Math.PI * clamp(progress, 0, 1));
			const size = stamp.size * (0.72 + progress * 0.5);
			context.save();
			context.globalAlpha = alpha * (stamp.sprite === "ring" ? 0.58 : 0.86);
			context.translate(stamp.x, stamp.y);
			context.rotate(stamp.rotation + progress * 0.12);
			context.drawImage(
				effectsAtlas,
				source.x,
				source.y,
				source.width,
				source.height,
				-size / 2,
				-size / 2,
				size,
				size,
			);
			context.restore();
		}

		const activeEnvelopeFrame = envelopeFlight
			? getSequenceFrameIndex(
					envelopeFlight.age,
					ENVELOPE_SEQUENCE_FPS,
					ENVELOPE_SEQUENCE_FRAMES.length,
					false,
				)
			: -1;
		if (activeEnvelopeFrame >= 0) {
			effects.dataset.envelopeFrame = String(activeEnvelopeFrame);
			effects.dataset.envelopeFrameCount = String(
				ENVELOPE_SEQUENCE_FRAMES.length,
			);
			effects.dataset.envelopeFrameFps = String(ENVELOPE_SEQUENCE_FPS);
		}

		if (envelopeFlight && envelopeSequenceAtlas) {
			if (effectsEnabled) envelopeFlight.age += delta;
			const progress = clamp(
				envelopeFlight.age / envelopeFlight.duration,
				0,
				1,
			);
			const eased = easeInOutCubic(progress);
			const x = lerp(envelopeFlight.startX, envelopeFlight.endX, eased);
			const y =
				lerp(envelopeFlight.startY, envelopeFlight.endY, eased) -
				Math.sin(Math.PI * progress) * height * 0.12;
			const frameIndex = envelopeFlight.reduced
				? 2
				: getSequenceFrameIndex(
						envelopeFlight.age,
						ENVELOPE_SEQUENCE_FPS,
						ENVELOPE_SEQUENCE_FRAMES.length,
						false,
					);
			const sequenceFrame = ENVELOPE_SEQUENCE_FRAMES[frameIndex];
			const alpha =
				Math.min(1, progress / (envelopeFlight.reduced ? 0.18 : 0.1)) *
				Math.min(1, (1 - progress) / 0.18);
			const drawWidth = clamp(width * 0.2, 280, 380);
			const drawHeight = drawWidth * 0.75;
			context.save();
			context.globalAlpha = clamp(alpha, 0, 1);
			context.translate(x, y);
			context.rotate(envelopeFlight.reduced ? 0 : lerp(-0.14, 0.04, eased));
			context.drawImage(
				envelopeSequenceAtlas,
				sequenceFrame.source.x,
				sequenceFrame.source.y,
				sequenceFrame.source.width,
				sequenceFrame.source.height,
				-drawWidth / 2,
				-drawHeight * 0.5,
				drawWidth,
				drawHeight,
			);
			context.restore();
			if (progress >= 1) {
				envelopeFlight = null;
				effects.dataset.envelopeState = "complete";
			}
		} else if (envelopeFlight && effectsEnabled) {
			envelopeFlight.age += delta;
			if (envelopeFlight.age >= envelopeFlight.duration) {
				envelopeFlight = null;
				effects.dataset.envelopeState = "asset-unavailable";
			}
		}

		for (let index = particles.length - 1; index >= 0; index -= 1) {
			const particle = particles[index];
			if (!reducedMotion && effectsEnabled) {
				particle.x += particle.vx * delta;
				particle.y += particle.vy * delta;
				particle.vy += 28 * delta;
				particle.life -= delta;
			}
			if (particle.life <= 0) {
				particles.splice(index, 1);
				continue;
			}
			context.save();
			context.globalAlpha = clamp(particle.life, 0, 1);
			context.translate(particle.x, particle.y);
			context.rotate(particle.vx * 0.008);
			context.fillStyle = particle.vx > 0 ? "#c13a46" : "#e5ddd2";
			context.beginPath();
			context.moveTo(0, -particle.size);
			context.lineTo(particle.size * 0.72, particle.size * 0.7);
			context.lineTo(-particle.size * 0.72, particle.size * 0.7);
			context.closePath();
			context.fill();
			context.restore();
		}
	};

	const tick = (time: number) => {
		frame = 0;
		if (destroyed) return;
		const delta = Math.min(0.05, Math.max(0.001, (time - lastTime) / 1000));
		lastTime = time;

		if (reducedMotion) {
			camera.zoom = targetCamera.zoom;
			camera.offsetX = targetCamera.offsetX;
			camera.offsetY = targetCamera.offsetY;
			camera.mode = targetCamera.mode;
		} else {
			transitionProgress = Math.min(
				1,
				transitionProgress + delta / transitionDuration,
			);
			const t = easeInOutCubic(transitionProgress);
			camera.zoom =
				transitionFrom.zoom + (targetCamera.zoom - transitionFrom.zoom) * t;
			camera.offsetX =
				transitionFrom.offsetX +
				(targetCamera.offsetX - transitionFrom.offsetX) * t;
			camera.offsetY =
				transitionFrom.offsetY +
				(targetCamera.offsetY - transitionFrom.offsetY) * t;
			camera.mode = targetCamera.mode;
		}

		drawBackdrop(time);
		drawEffects(delta);
		frame = window.requestAnimationFrame(tick);
	};

	const handlePointerMove = (event: PointerEvent) => {
		const rect = container.getBoundingClientRect();
		pointerX = clamp((event.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
		pointerY = clamp((event.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
		pointerActive = true;
		pointerPressed = event.isPrimary && event.buttons > 0;
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (!event.isPrimary) return;
		pointerActive = true;
		pointerPressed = true;
	};

	const handlePointerUp = (event: PointerEvent) => {
		if (event.isPrimary) pointerPressed = false;
	};

	const handlePointerLeave = () => {
		pointerX = 0;
		pointerY = 0;
		pointerActive = false;
		pointerPressed = false;
	};

	const handleMotionChange = (event: MediaQueryListEvent) => {
		reducedMotion = event.matches;
		if (reducedMotion) {
			particles.length = 0;
			stamps.length = 0;
			envelopeFlight = null;
			camera = { ...targetCamera };
		}
	};

	const resizeObserver = new ResizeObserver(updateCanvasSize);
	resizeObserver.observe(container);
	container.addEventListener("pointermove", handlePointerMove, {
		passive: true,
	});
	container.addEventListener("pointerdown", handlePointerDown, {
		passive: true,
	});
	container.addEventListener("pointerup", handlePointerUp, { passive: true });
	container.addEventListener("pointercancel", handlePointerLeave);
	container.addEventListener("pointerleave", handlePointerLeave);
	motionQuery.addEventListener("change", handleMotionChange);
	updateCanvasSize();

	void Promise.all([
		loadImage(backgroundUrl),
		loadImage(effectsAtlasUrl),
		loadImage(envelopeSequenceAtlasUrl),
	])
		.then(
			([
				nextBackground,
				nextEffectsAtlas,
				nextEnvelopeSequenceAtlas,
			]) => {
				if (destroyed) return;
				background = nextBackground;
				effectsAtlas = nextEffectsAtlas;
				envelopeSequenceAtlas = nextEnvelopeSequenceAtlas;
				backdrop.dataset.assetState = "ready";
				effects.dataset.assetState = "ready";
			},
		)
		.catch(() => {
			backdrop.dataset.assetState = "error";
			effects.dataset.assetState = "error";
		});

	frame = window.requestAnimationFrame(tick);

	return {
		setCamera(mode, transition = "smooth") {
			transitionFrom = { ...camera };
			targetCamera = { ...CAMERA_PRESETS[mode] };
			if (transition === "cut" || reducedMotion) {
				// 即时跳位，不做过渡动画
				camera = { ...targetCamera };
				transitionProgress = 1;
			} else {
				transitionProgress = 0;
				transitionDuration = 0.65;
			}
			backdrop.dataset.cameraMode = mode;
			onCameraChange?.({ ...targetCamera });
			return { ...targetCamera };
		},
		setEffectsEnabled(enabled) {
			effectsEnabled = enabled;
			backdrop.dataset.effects = enabled ? "on" : "off";
			effects.dataset.effects = enabled ? "on" : "off";
			if (!enabled) {
				particles.length = 0;
				stamps.length = 0;
				envelopeFlight = null;
			}
		},
		spawnEnvelopeFlight() {
			if (!effectsEnabled) return;
			const rect = container.getBoundingClientRect();
			const drawWidth = clamp(rect.width * 0.16, 240, 340);
			const chat = container.querySelector<HTMLElement>(
				".xiao-chat:not(.is-chat-hidden)",
			);
			const chatRect = chat?.getBoundingClientRect();
			const chatLeft = chatRect ? chatRect.left - rect.left : rect.width * 0.78;
			const endX = chatRect
				? clamp(
						chatLeft - drawWidth * 0.56 - 30,
						rect.width * 0.5,
						rect.width * 0.82,
					)
				: rect.width * 0.78;
			const endY = chatRect
				? clamp(
						chatRect.top - rect.top + chatRect.height * 0.26,
						rect.height * 0.22,
						rect.height * 0.7,
					)
				: rect.height * 0.4;
			effects.dataset.lastEffect = "envelope-flight";
			effects.dataset.envelopeState = "playing";
			effects.dataset.envelopeFrameCount = String(
				ENVELOPE_SEQUENCE_FRAMES.length,
			);
			effects.dataset.envelopeFrameFps = String(ENVELOPE_SEQUENCE_FPS);
			effects.dataset.sequenceSource = "derived-sequence-atlas";
			envelopeFlight = {
				age: 0,
				duration: reducedMotion
					? REDUCED_ENVELOPE_DURATION
					: ENVELOPE_SEQUENCE_DURATION,
				startX: rect.width * 0.34,
				startY: rect.height * 0.56,
				endX,
				endY,
				reduced: reducedMotion,
			};
		},
		burst(clientX, clientY) {
			// reducedMotion 时跳过粒子效果，防止 stamps 因 life 不递减而无限堆积
			if (!effectsEnabled || reducedMotion) return;
			// 防止快速点击堆积过多 stamps/particles 拖慢渲染
			if (stamps.length >= 12 || particles.length >= 120) return;
			const rect = container.getBoundingClientRect();
			const x = clientX - rect.left;
			const y = clientY - rect.top;
			stamps.push(
				{
					x,
					y,
					life: 0.9,
					maxLife: 0.9,
					size: 150,
					rotation: Math.random() * 0.18 - 0.09,
					sprite: "ring",
				},
				{
					x,
					y,
					life: 0.58,
					maxLife: 0.58,
					size: 104,
					rotation: Math.random() * 0.3 - 0.15,
					sprite: "sparkle",
				},
			);
			for (let index = 0; index < 18; index += 1) {
				const angle = (Math.PI * 2 * index) / 18 + Math.random() * 0.22;
				const speed = 52 + Math.random() * 92;
				particles.push({
					x,
					y,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed,
					life: 0.75 + Math.random() * 0.45,
					size: 2.5 + Math.random() * 3.5,
				});
			}
		},
		getState() {
			return {
				...camera,
				effectsEnabled,
			};
		},
		getPointerNormalized() {
			return pointerActive
				? { x: pointerX, y: pointerY, pressed: pointerPressed }
				: null;
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			if (frame) window.cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			container.removeEventListener("pointermove", handlePointerMove);
			container.removeEventListener("pointerdown", handlePointerDown);
			container.removeEventListener("pointerup", handlePointerUp);
			container.removeEventListener("pointercancel", handlePointerLeave);
			container.removeEventListener("pointerleave", handlePointerLeave);
			motionQuery.removeEventListener("change", handleMotionChange);
			particles.length = 0;
			stamps.length = 0;
			envelopeFlight = null;
		},
	};
}
