export type VampireCameraMode = "wide" | "portrait" | "closeup";

export interface VampireCameraState {
	mode: VampireCameraMode;
	zoom: number;
	offsetX: number;
	offsetY: number;
}

export interface CharacterCameraView {
	scale: number;
	offsetX: number;
	offsetY: number;
}

/**
 * 以吸血鬼完整模型高度为基准的三档取景。半身保留到腰线；近景参考
 * 用户给定构图，只保留完整头部、胸前主体与腰线上缘，并给发顶留白。
 */
export const CAMERA_PRESETS: Record<VampireCameraMode, VampireCameraState> = {
	wide: { mode: "wide", zoom: 0.92, offsetX: 0, offsetY: -0.02 },
	portrait: { mode: "portrait", zoom: 1.82, offsetX: 0, offsetY: 0.325 },
	closeup: { mode: "closeup", zoom: 4.7, offsetX: 0, offsetY: 1.69 },
};

const CHAT_SAFE_OFFSETS: Record<VampireCameraMode, number> = {
	wide: -0.13,
	portrait: -0.16,
	closeup: -0.18,
};

export function resolveCharacterCamera(
	mode: VampireCameraMode,
	chatHidden: boolean,
): CharacterCameraView {
	const preset = CAMERA_PRESETS[mode];
	return {
		scale: preset.zoom,
		offsetX: preset.offsetX + (chatHidden ? 0 : CHAT_SAFE_OFFSETS[mode]),
		offsetY: preset.offsetY,
	};
}
