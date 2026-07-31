export interface VampireStageConfig {
	background: string;
	ornamentAtlas: string;
	effectsAtlas: string;
	envelopeSequenceAtlas: string;
	modelPath: string;
	cubismCorePath: string;
}

export interface VampireIntroFrameConfig {
	src: string;
	label: string;
	holdMs: number;
}

export interface VampireIntroConfig {
	title: string;
	subtitle: string;
	frames: VampireIntroFrameConfig[];
	videoPath: string;
	posterPath: string;
	durationMs: number;
	revealAtMs: number;
}

const configuredModelPath = import.meta.env.PUBLIC_VAMPIRE_MODEL_URL?.trim();
const configuredCorePath = import.meta.env.PUBLIC_CUBISM_CORE_URL?.trim();
const localVampireModelPath = import.meta.env.DEV
	? "/__local-vampire/v1/model.model3.json"
	: "/assets/live2d/vampire-web-v1/model.model3.json";

export const xiaoConfig = {
	stage: {
		// task-4250-1 是用户生成的哥特红色背景
		background: "/assets/images/xiao/vampire-gothic/task-4250-1.png",
		ornamentAtlas:
			"/assets/images/xiao/vampire-gothic/silver-ornaments-atlas-4k.png",
		effectsAtlas:
			"/assets/images/xiao/vampire-gothic/envelope-effects-atlas-4k.png",
		envelopeSequenceAtlas:
			"/assets/images/xiao/vampire-gothic/envelope-sequence-atlas.png",
		modelPath: configuredModelPath || localVampireModelPath,
		cubismCorePath:
			configuredCorePath || "/assets/vendor/live2dcubismcore.min.js",
	} satisfies VampireStageConfig,
	intro: {
		title: "VAMPIRE",
		subtitle: "VAMPIRE · SOULLINK",
		frames: [
			{
				src: "/assets/images/xiao/chain-cinematic-v2/shot-01.webp",
				label: "Moonlit chapel establishing shot",
				holdMs: 2_650,
			},
			{
				src: "/assets/images/xiao/chain-cinematic-v2/shot-02.webp",
				label: "Crimson eye close-up",
				holdMs: 770,
			},
			{
				src: "/assets/images/xiao/chain-cinematic-v2/shot-03.webp",
				label: "White-form transformation",
				holdMs: 840,
			},
			{
				src: "/assets/images/xiao/chain-cinematic-v2/shot-04.webp",
				label: "Black-form silhouette",
				holdMs: 860,
			},
			{
				src: "/assets/images/xiao/chain-cinematic-v2/shot-05.webp",
				label: "Final vampire portrait",
				holdMs: 5_680,
			},
		],
		videoPath: "/assets/images/xiao/chain-cinematic-v2/vampire-cinematic.webm",
		posterPath: "/assets/images/xiao/chain-cinematic-v2/shot-01.webp",
		durationMs: 15_000,
		revealAtMs: 10_800,
	} satisfies VampireIntroConfig,
};
