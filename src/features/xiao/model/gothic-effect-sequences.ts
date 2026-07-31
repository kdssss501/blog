export interface AtlasFrameSource {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface EnvelopeSequenceFrame {
	source: AtlasFrameSource;
}

export const ENVELOPE_SEQUENCE_FPS = 10;

/** Twelve 480px frames arranged as two rows of six in the derived envelope atlas. */
export const ENVELOPE_SEQUENCE_FRAMES: readonly EnvelopeSequenceFrame[] = [
	...Array.from({ length: 12 }, (_, index) => ({
		source: {
			x: (index % 6) * 480,
			y: Math.floor(index / 6) * 360,
			width: 480,
			height: 360,
		},
	})),
] as const;

export function getSequenceFrameIndex(
	elapsedSeconds: number,
	fps: number,
	frameCount: number,
	loop: boolean,
): number {
	if (frameCount <= 1 || fps <= 0) return 0;
	const rawIndex = Math.max(0, Math.floor(elapsedSeconds * fps));
	return loop ? rawIndex % frameCount : Math.min(frameCount - 1, rawIndex);
}
