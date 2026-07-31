export const VAMPIRE_CHIBI_FRAME_COUNT = 16;
export const VAMPIRE_CHIBI_FRAME_DELAY_MS = 90;
export const VAMPIRE_CHIBI_ATLAS_COLUMNS = 4;
export const VAMPIRE_CHIBI_FRAME_SIZE = 384;

export function getVampireChibiFrameIndex(elapsedMs: number): number {
	if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
	return (
		Math.floor(elapsedMs / VAMPIRE_CHIBI_FRAME_DELAY_MS) %
		VAMPIRE_CHIBI_FRAME_COUNT
	);
}
