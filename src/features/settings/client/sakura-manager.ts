/**
 * Sakura motion model adapted from tianshihao2003/dumpling-theme at
 * 73b97596c09fb8b27ee7ab56221c270b35a21ae3 (MIT, see root LICENSE).
 * Petals are drawn as canvas paths so the effect has no unlicensed image asset.
 */

interface SakuraParticle {
	x: number;
	y: number;
	size: number;
	alpha: number;
	rotation: number;
	rotationSpeed: number;
	drift: number;
	fallSpeed: number;
	swing: number;
	swingSpeed: number;
}

export interface SakuraManagerOptions {
	count: number;
	zIndex: number;
}

const DEFAULT_OPTIONS: SakuraManagerOptions = {
	count: 21,
	zIndex: 48,
};

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

export class SakuraManager {
	private readonly canvas: HTMLCanvasElement;
	private readonly context: CanvasRenderingContext2D;
	private readonly options: SakuraManagerOptions;
	private readonly particles: SakuraParticle[] = [];
	private readonly reducedMotion: MediaQueryList;
	private animationId: number | null = null;
	private enabled = false;
	private visible = true;
	private width = 0;
	private height = 0;

	constructor(
		canvas: HTMLCanvasElement,
		options: Partial<SakuraManagerOptions> = {},
	) {
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Sakura canvas is unavailable");

		this.canvas = canvas;
		this.context = context;
		this.options = { ...DEFAULT_OPTIONS, ...options };
		this.canvas.style.zIndex = String(this.options.zIndex);
		this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

		this.handleResize = this.handleResize.bind(this);
		this.handleMotionChange = this.handleMotionChange.bind(this);
		this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
		window.addEventListener("resize", this.handleResize, { passive: true });
		this.reducedMotion.addEventListener("change", this.handleMotionChange);
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		this.handleResize();
	}

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		this.syncAnimation();
	}

	destroy(): void {
		this.stop();
		window.removeEventListener("resize", this.handleResize);
		this.reducedMotion.removeEventListener("change", this.handleMotionChange);
		document.removeEventListener(
			"visibilitychange",
			this.handleVisibilityChange,
		);
	}

	private syncAnimation(): void {
		const shouldRun =
			this.enabled && this.visible && !this.reducedMotion.matches;
		this.canvas.dataset.active = shouldRun ? "true" : "false";
		if (shouldRun) this.start();
		else this.stop();
	}

	private start(): void {
		if (this.animationId !== null) return;
		if (this.particles.length === 0) {
			for (let index = 0; index < this.options.count; index += 1) {
				this.particles.push(this.createParticle(true));
			}
		}
		this.animationId = window.requestAnimationFrame(this.drawFrame);
	}

	private stop(): void {
		if (this.animationId !== null) {
			window.cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		this.context.clearRect(0, 0, this.width, this.height);
	}

	private readonly drawFrame = (): void => {
		this.context.clearRect(0, 0, this.width, this.height);
		for (const particle of this.particles) {
			this.updateParticle(particle);
			this.drawParticle(particle);
		}
		this.animationId = window.requestAnimationFrame(this.drawFrame);
	};

	private createParticle(initial: boolean): SakuraParticle {
		const particle = {} as SakuraParticle;
		this.resetParticle(particle, initial);
		return particle;
	}

	private resetParticle(particle: SakuraParticle, initial: boolean): void {
		particle.x = randomBetween(0, this.width + 80);
		particle.y = initial
			? randomBetween(-40, this.height)
			: randomBetween(-80, -20);
		particle.size = randomBetween(5, 11);
		particle.alpha = randomBetween(0.35, 0.82);
		particle.rotation = randomBetween(0, Math.PI * 2);
		particle.rotationSpeed = randomBetween(-0.025, 0.035);
		particle.drift = randomBetween(-0.9, -0.25);
		particle.fallSpeed = randomBetween(0.75, 1.7);
		particle.swing = randomBetween(0, Math.PI * 2);
		particle.swingSpeed = randomBetween(0.012, 0.03);
	}

	private updateParticle(particle: SakuraParticle): void {
		particle.swing += particle.swingSpeed;
		particle.x += particle.drift + Math.sin(particle.swing) * 0.45;
		particle.y += particle.fallSpeed;
		particle.rotation += particle.rotationSpeed;
		if (
			particle.y > this.height + 30 ||
			particle.x < -50 ||
			particle.x > this.width + 50
		) {
			this.resetParticle(particle, false);
		}
	}

	private drawParticle(particle: SakuraParticle): void {
		const { context } = this;
		const size = particle.size;
		context.save();
		context.translate(particle.x, particle.y);
		context.rotate(particle.rotation);
		context.globalAlpha = particle.alpha;
		context.fillStyle = "#f7a9c4";
		context.strokeStyle = "rgba(255, 255, 255, 0.55)";
		context.lineWidth = 0.7;
		context.beginPath();
		context.moveTo(0, -size);
		context.bezierCurveTo(
			size * 0.7,
			-size * 0.72,
			size * 0.68,
			size * 0.34,
			0,
			size,
		);
		context.bezierCurveTo(
			-size * 0.68,
			size * 0.34,
			-size * 0.7,
			-size * 0.72,
			0,
			-size,
		);
		context.closePath();
		context.fill();
		context.stroke();
		context.restore();
	}

	private handleResize(): void {
		const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.canvas.width = Math.round(this.width * pixelRatio);
		this.canvas.height = Math.round(this.height * pixelRatio);
		this.canvas.style.width = `${this.width}px`;
		this.canvas.style.height = `${this.height}px`;
		this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	}

	private handleMotionChange(): void {
		this.syncAnimation();
	}

	private handleVisibilityChange(): void {
		this.visible = document.visibilityState !== "hidden";
		this.syncAnimation();
	}
}
