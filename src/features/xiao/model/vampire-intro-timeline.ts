export const VAMPIRE_INTRO_SESSION_KEY = "blog:vampire:intro:v1";

export const VAMPIRE_INTRO_TIMINGS = {
	framesEndMs: 4_600,
	titleEndMs: 6_200,
	chainEndMs: 8_000,
	lockEndMs: 10_800,
	revealMs: 10_800,
	exitMs: 13_500,
	durationMs: 15_000,
} as const;

export const VAMPIRE_INTRO_FRAME_CUES_MS = [
	0, 2_650, 3_420, 4_260, 5_120,
] as const;

export type VampireIntroPhase =
	| "frames"
	| "title"
	| "chain"
	| "locked"
	| "revealed"
	| "exit"
	| "complete";

export interface VampireIntroMoment {
	phase: VampireIntroPhase;
	frameIndex: number;
	revealed: boolean;
	complete: boolean;
}

export function resolveVampireIntroMoment(
	elapsedMs: number,
	frameCount: number,
	skipped = false,
): VampireIntroMoment {
	const safeElapsed = Math.max(0, elapsedMs);
	const lastFrame = Math.max(0, frameCount - 1);
	if (skipped || safeElapsed >= VAMPIRE_INTRO_TIMINGS.durationMs) {
		return {
			phase: "complete",
			frameIndex: lastFrame,
			revealed: true,
			complete: true,
		};
	}

	let phase: VampireIntroPhase = "frames";
	if (safeElapsed >= VAMPIRE_INTRO_TIMINGS.exitMs) phase = "exit";
	else if (safeElapsed >= VAMPIRE_INTRO_TIMINGS.revealMs) phase = "revealed";
	else if (safeElapsed >= VAMPIRE_INTRO_TIMINGS.chainEndMs) phase = "locked";
	else if (safeElapsed >= VAMPIRE_INTRO_TIMINGS.titleEndMs) phase = "chain";
	else if (safeElapsed >= VAMPIRE_INTRO_TIMINGS.framesEndMs) phase = "title";

	let cueIndex = 0;
	for (let index = 0; index < VAMPIRE_INTRO_FRAME_CUES_MS.length; index += 1) {
		if (safeElapsed < VAMPIRE_INTRO_FRAME_CUES_MS[index]) break;
		cueIndex = index;
	}

	return {
		phase,
		frameIndex: Math.min(lastFrame, cueIndex % Math.max(1, frameCount)),
		revealed: safeElapsed >= VAMPIRE_INTRO_TIMINGS.revealMs,
		complete: false,
	};
}
