import type {
	EmotionIntent,
	PartialFACSLikeState,
	SoullinkExternalPlan,
	VADVector,
} from "@soullink-emotion/engine";

type SoullinkActionPlan = NonNullable<SoullinkExternalPlan["actionPlan"]>;
type SoullinkParameterPlan = NonNullable<SoullinkExternalPlan["parameterPlan"]>;

export const VAMPIRE_EXPRESSION_CONTROLS = [
	{ id: "shy", label: "脸红", safe: true },
	{ id: "sad", label: "哭哭", safe: true },
	{ id: "mad", label: "黑脸生气", safe: true },
	{ id: "hearteyes", label: "爱心眼", safe: true },
	{ id: "stareyes", label: "星星眼", safe: true },
	{ id: "circleeyes", label: "蚊香眼", safe: true },
] as const;

export const VAMPIRE_ACTION_CONTROLS = [
	{ id: "mc", label: "麦克风" },
	{ id: "mouse", label: "数位板" },
	{ id: "knife", label: "捧脸美工刀" },
	{ id: "click", label: "点击" },
] as const;

export const VAMPIRE_EFFECT_CONTROLS = [
	{ id: "blood-face", label: "面部血迹" },
	{ id: "blood-body", label: "身体血迹" },
] as const;

export type VampireExpressionName =
	(typeof VAMPIRE_EXPRESSION_CONTROLS)[number]["id"];
export type VampireActionName = (typeof VAMPIRE_ACTION_CONTROLS)[number]["id"];
export type VampireEffectName = (typeof VAMPIRE_EFFECT_CONTROLS)[number]["id"];
export type VampirePerformanceSource = "user" | "assistant" | "manual";

interface VampireCosmeticParameterDefinition {
	id: string;
	label: string;
	min: number;
	max: number;
	default: number;
}

export const VAMPIRE_COSMETIC_PARAMETERS = {
	outfitWhite: {
		id: "PARAMoutfit1_2",
		label: "服装色",
		min: 0,
		max: 1,
		default: 0,
	},
	hairWhite: { id: "PARAMhariWB", label: "发色", min: 0, max: 1, default: 0 },
	accessoryWhite: {
		id: "PARAMhariWB2",
		label: "发饰色",
		min: 0,
		max: 1,
		default: 0,
	},
	ahoge: { id: "PARAMahoke", label: "呆毛", min: 0, max: 1, default: 1 },
	bangsStyle: {
		id: "PARAMhari_1",
		label: "刘海样式",
		min: 0,
		max: 1,
		default: 0,
	},
	straightBangsLength: {
		id: "PARAMhari_6",
		label: "齐刘海长度",
		min: -1,
		max: 1,
		default: 0,
	},
	mBangsLength: {
		id: "PARAMhari_7",
		label: "M 刘海长度",
		min: -1,
		max: 1,
		default: 0,
	},
	sideHairLength: {
		id: "PARAMhari_8",
		label: "侧发长度",
		min: -1,
		max: 1,
		default: 0,
	},
	ponytailLeft: {
		id: "PARAMhari_2_1",
		label: "左马尾",
		min: 0,
		max: 1,
		default: 1,
	},
	ponytailRight: {
		id: "PARAMhari_2_2",
		label: "右马尾",
		min: 0,
		max: 1,
		default: 1,
	},
	ponytails: { id: "PARAMhari_2", label: "马尾", min: 0, max: 1, default: 1 },
	ponytailLength: {
		id: "PARAMhari_5",
		label: "马尾长度",
		min: -1,
		max: 1,
		default: 0,
	},
	longHair: { id: "PARAMhari_3", label: "长发", min: 0, max: 1, default: 0 },
	longHairLength: {
		id: "PARAMhari_4",
		label: "长发长度",
		min: -1,
		max: 1,
		default: 0,
	},
	hairpin1: {
		id: "PARAMhairpin_1",
		label: "创口贴发夹",
		min: 0,
		max: 1,
		default: 0,
	},
	hairpin2: {
		id: "PARAMhairpin_2",
		label: "环形发夹",
		min: 0,
		max: 1,
		default: 0,
	},
	hairpin3: {
		id: "PARAMhairpin_3",
		label: "十字架发夹",
		min: 0,
		max: 1,
		default: 0,
	},
} as const satisfies Record<string, VampireCosmeticParameterDefinition>;

export type VampireCosmeticKey = keyof typeof VAMPIRE_COSMETIC_PARAMETERS;
export type VampireCosmetics = Partial<Record<VampireCosmeticKey, number>>;

interface VampireTrackedParameterDefinition {
	id: string;
	min: number;
	max: number;
	neutral: number;
}

export const VAMPIRE_VBRIDGER_PARAMETERS = {
	forwardLean: {
		id: "PARAM_BODY_POSITION_Z",
		min: 0,
		max: 10,
		neutral: 0,
	},
	mouthFunnel: { id: "PARAMMOUSEFUNNEL", min: 0, max: 1, neutral: 0 },
	mouthShrug: { id: "PARAM_MOUSE_SHRUG", min: 0, max: 1, neutral: 0 },
	jawOpen: { id: "PARAM_JAW_OPEN", min: 0, max: 1, neutral: 0 },
	cheekPuff: { id: "PARAM_CHEEK_PUFF", min: 0, max: 1, neutral: 0 },
	mouthSkew: { id: "PARAMMOUSE_X", min: -1, max: 1, neutral: 0 },
	lipPress: {
		id: "PARAMMOUSE_PRESS_LIP_OPEN",
		min: -1,
		max: 1,
		neutral: 0,
	},
	mouthPucker: { id: "PARAMMOUSE_PUNKER", min: -1, max: 1, neutral: 0 },
} as const satisfies Record<string, VampireTrackedParameterDefinition>;

export type VampireVBridgerKey = keyof typeof VAMPIRE_VBRIDGER_PARAMETERS;

export const VAMPIRE_VBRIDGER_NEUTRAL_PARAMETERS = Object.fromEntries(
	Object.values(VAMPIRE_VBRIDGER_PARAMETERS).map((definition) => [
		definition.id,
		definition.neutral,
	]),
) as Readonly<Record<string, number>>;

export const VAMPIRE_ACTION_PARAMETERS: Record<
	VampireActionName,
	Readonly<Record<string, number>>
> = {
	mc: { PARAMhands_1: 1, PARAMhands_2: 0, PARAMhands_3: 0 },
	knife: { PARAMhands_1: 0, PARAMhands_2: 1, PARAMhands_3: 0 },
	mouse: { PARAMhands_1: 0, PARAMhands_2: 0, PARAMhands_3: 1 },
	click: { Paramclick: 1 },
};

export const VAMPIRE_ACTION_NEUTRAL_PARAMETERS = {
	PARAMhands_1: 0,
	PARAMhands_2: 0,
	PARAMhands_3: 0,
	Paramclick: 0,
} as const;

export const VAMPIRE_EFFECT_PARAMETERS: Record<
	VampireEffectName,
	Readonly<Record<string, number>>
> = {
	"blood-face": { PARAMBLOOD2: 1 },
	"blood-body": { PARAMblood1: 1 },
};

export const VAMPIRE_EFFECT_NEUTRAL_PARAMETERS = {
	PARAMBLOOD2: 0,
	PARAMblood1: 0,
} as const;

export interface VampirePerformanceCue {
	source: VampirePerformanceSource;
	scenario: string;
	intent: EmotionIntent;
	expression: VampireExpressionName | null;
	action: VampireActionName | null;
	effects: VampireEffectName[];
	durationMs: number;
}

export interface VampirePerformancePlan {
	cue: VampirePerformanceCue;
	plan: SoullinkExternalPlan;
}

interface AssistantScenario {
	id: string;
	pattern: RegExp;
	emotion: string;
	variant: string;
	intensity: number;
	contextTags: string[];
	vadTarget: Partial<VADVector>;
	expression: VampireExpressionName;
}

const ASSISTANT_SCENARIOS: AssistantScenario[] = [
	{
		id: "warning",
		pattern: /(危险|警告|立即停止|不能继续|不可以继续|先停下|拒绝执行)/u,
		emotion: "anger",
		variant: "guarded_warning",
		intensity: 0.72,
		contextTags: ["warning", "protective"],
		vadTarget: { valence: -0.45, arousal: 0.62, dominance: 0.58 },
		expression: "mad",
	},
	{
		id: "comfort",
		pattern: /(辛苦了|慢慢来|陪着你|陪你|难过|委屈|害怕|不安|先休息|抱歉)/u,
		emotion: "concerned",
		variant: "comfort",
		intensity: 0.7,
		contextTags: ["comfort", "warm"],
		vadTarget: { valence: -0.18, arousal: -0.24, dominance: -0.08 },
		expression: "sad",
	},
	{
		id: "celebration",
		pattern: /(成功|通过了|完成了|太好了|恭喜|好消息|解决了|已经修好)/u,
		emotion: "happy",
		variant: "celebrating",
		intensity: 0.84,
		contextTags: ["good_news", "celebration"],
		vadTarget: { valence: 0.72, arousal: 0.48, dominance: 0.34 },
		expression: "stareyes",
	},
	{
		id: "affection",
		pattern: /(谢谢你|晚安|愿意告诉我|很高兴见到|这封信很认真|我会记住)/u,
		emotion: "affectionate",
		variant: "warm_reply",
		intensity: 0.76,
		contextTags: ["warm", "affectionate"],
		vadTarget: { valence: 0.58, arousal: 0.08, dominance: 0.02 },
		expression: "hearteyes",
	},
	{
		id: "uncertain",
		pattern: /(有点奇怪|不太确定|需要再确认|再检查一次|意外结果|没有看懂)/u,
		emotion: "confused",
		variant: "checking",
		intensity: 0.68,
		contextTags: ["question", "checking"],
		vadTarget: { valence: -0.08, arousal: 0.22, dominance: -0.18 },
		expression: "circleeyes",
	},
	{
		id: "curious_work",
		pattern:
			/(有意思|让我看看|我来分析|检查代码|看看代码|调试|实现|设计|绘制|修图)/u,
		emotion: "curious",
		variant: "focused",
		intensity: 0.7,
		contextTags: ["curious", "focused_work"],
		vadTarget: { valence: 0.24, arousal: 0.32, dominance: 0.28 },
		expression: "stareyes",
	},
];

const expressionForEmotion = (
	emotion: string,
): VampireExpressionName | null => {
	switch (emotion) {
		case "shy":
			return "shy";
		case "affectionate":
			return "hearteyes";
		case "happy":
		case "excited":
		case "curious":
			return "stareyes";
		case "surprised":
		case "confused":
			return "circleeyes";
		case "tired":
		case "sad":
		case "concerned":
		case "anxiety":
			return "sad";
		case "anger":
		case "angry":
		case "mad":
			return "mad";
		default:
			return null;
	}
};

const resolveAction = (message: string): VampireActionName | null => {
	if (/(美工刀|刀刃|切割|危险|警告|保护|战斗)/u.test(message)) return "knife";
	if (/(数位板|绘图|画画|绘制|设计稿|修图|代码|编程|实现|调试)/u.test(message))
		return "mouse";
	if (/(麦克风|直播|播报|朗读|读给你|念给你|唱一段|演唱)/u.test(message))
		return "mc";
	if (/(点击|点一下|按下按钮)/u.test(message)) return "click";
	return null;
};

const resolveEffects = (message: string): VampireEffectName[] => {
	const effects: VampireEffectName[] = [];
	if (/(脸上.*血|面部.*血|咬伤|吸血)/u.test(message))
		effects.push("blood-face");
	if (/(胸口.*血|身体.*血|衣服.*血|满身血|受伤|战斗)/u.test(message))
		effects.push("blood-body");
	if (effects.length === 0 && /(血迹|流血)/u.test(message))
		effects.push("blood-face", "blood-body");
	return effects;
};

const actionFacsForEmotion = (emotion: string): PartialFACSLikeState => {
	switch (emotion) {
		case "happy":
		case "excited":
			return { eyeSmile: 0.62, headZ: 0.12, bodyY: 0.08 };
		case "affectionate":
		case "shy":
			return { blush: 0.72, headZ: -0.12, gazeX: 0.12 };
		case "sad":
		case "concerned":
		case "tired":
			return { headY: -0.16, gazeY: -0.12, bodyY: -0.08 };
		case "anxiety":
			return { headX: -0.1, gazeX: 0.16, bodyX: -0.08 };
		case "anger":
		case "angry":
		case "mad":
			return { browDown: 0.72, headY: -0.08, bodyX: 0.1 };
		case "surprised":
		case "confused":
			return { eyeOpen: 1, headZ: 0.14, gazeY: 0.08 };
		case "curious":
			return { headZ: -0.14, gazeX: -0.12, bodyY: 0.08 };
		default:
			return { breath: 0.58 };
	}
};

const buildActionPlan = (emotion: string): SoullinkActionPlan => [
	{
		time: 0,
		duration: 1.1,
		label: `vampire-${emotion}`,
		intensity: 0.78,
		facs: actionFacsForEmotion(emotion),
	},
];

const vbridgerAccentForEmotion = (
	emotion: string,
): Partial<Record<VampireVBridgerKey, number>> => {
	switch (emotion) {
		case "happy":
		case "excited":
			return { forwardLean: 5.2, jawOpen: 0.28, mouthSkew: 0.12 };
		case "affectionate":
		case "shy":
			return {
				forwardLean: 7.2,
				cheekPuff: 0.68,
				lipPress: 0.26,
				mouthFunnel: 0.34,
				mouthPucker: 0.46,
			};
		case "sad":
		case "concerned":
		case "tired":
			return { forwardLean: 3.2, mouthShrug: 0.44, lipPress: 0.18 };
		case "anxiety":
			return { forwardLean: 4.1, mouthShrug: 0.58, mouthSkew: -0.24 };
		case "anger":
		case "angry":
		case "mad":
			return { forwardLean: 6.6, lipPress: 0.74, mouthSkew: -0.32 };
		case "surprised":
		case "confused":
			return { forwardLean: 3.8, mouthShrug: 0.76, mouthSkew: -0.42 };
		case "curious":
			return { forwardLean: 5.8, cheekPuff: 0.12, mouthSkew: 0.3 };
		default:
			return { forwardLean: 2.4 };
	}
};

const toNativeParameters = (
	channels: Partial<Record<VampireVBridgerKey, number>>,
) => {
	const parameters: Record<string, number> = {};
	for (const [key, value] of Object.entries(channels) as Array<
		[VampireVBridgerKey, number | undefined]
	>) {
		if (value === undefined) continue;
		const definition = VAMPIRE_VBRIDGER_PARAMETERS[key];
		parameters[definition.id] = Math.min(
			definition.max,
			Math.max(definition.min, value),
		);
	}
	return parameters;
};

const mouthGestureForMessage = (
	message: string,
): Partial<Record<VampireVBridgerKey, number>> => {
	const gesture: Partial<Record<VampireVBridgerKey, number>> = {};
	if (/(鼓脸|鼓起脸|鼓起腮|鼓腮|赌气)/u.test(message)) {
		Object.assign(gesture, { cheekPuff: 0.9, lipPress: 0.22 });
	}
	if (/(噘嘴|嘟嘴|亲吻|吻你|啾)/u.test(message)) {
		Object.assign(gesture, { mouthFunnel: 0.72, mouthPucker: 0.86 });
	}
	if (/(抿嘴|闭紧嘴|忍住不说)/u.test(message)) {
		Object.assign(gesture, { lipPress: 0.9, jawOpen: 0 });
	}
	if (/(歪嘴|坏笑|狡黠|得意)/u.test(message)) {
		Object.assign(gesture, { mouthSkew: 0.78, lipPress: -0.14 });
	}
	if (/(咧嘴|扁嘴|嘴角拉开)/u.test(message)) {
		Object.assign(gesture, { mouthFunnel: 0, mouthPucker: -0.68 });
	}
	return gesture;
};

const buildParameterPlan = (
	emotion: string,
	message: string,
): SoullinkParameterPlan => {
	const accent = {
		...vbridgerAccentForEmotion(emotion),
		...mouthGestureForMessage(message),
	};
	const accentParameters = toNativeParameters(accent);
	const lean = accent.forwardLean ?? 2.4;

	if (/(咀嚼|嚼一嚼|吃一口|品尝|点心|蛋糕|饼干)/u.test(message)) {
		const chewBase = toNativeParameters({
			...accent,
			cheekPuff: Math.max(accent.cheekPuff ?? 0, 0.32),
		});
		return [
			{
				time: 0,
				duration: 0.16,
				label: `vampire-${emotion}-chew-open-1`,
				parameters: { ...chewBase, PARAM_JAW_OPEN: 0.64 },
			},
			{
				time: 0.2,
				duration: 0.12,
				label: `vampire-${emotion}-chew-close-1`,
				parameters: { ...chewBase, PARAM_JAW_OPEN: 0.08 },
			},
			{
				time: 0.42,
				duration: 0.14,
				label: `vampire-${emotion}-chew-open-2`,
				parameters: { ...chewBase, PARAM_JAW_OPEN: 0.52 },
			},
			{
				time: 0.65,
				duration: 0.16,
				label: `vampire-${emotion}-chew-close-2`,
				parameters: { ...chewBase, PARAM_JAW_OPEN: 0.06 },
			},
			{
				time: 1.05,
				duration: 0.36,
				label: `vampire-${emotion}-release`,
				parameters: { ...VAMPIRE_VBRIDGER_NEUTRAL_PARAMETERS },
			},
		];
	}

	return [
		{
			time: 0,
			duration: 0.24,
			label: `vampire-${emotion}-accent`,
			parameters: accentParameters,
		},
		{
			time: 1.08,
			duration: 0.38,
			label: `vampire-${emotion}-release`,
			parameters: {
				...VAMPIRE_VBRIDGER_NEUTRAL_PARAMETERS,
				PARAM_BODY_POSITION_Z: Math.min(1.2, lean * 0.2),
			},
		},
	];
};

export function buildVampirePerformancePlan(
	baseIntent: EmotionIntent,
	message: string,
	source: Exclude<VampirePerformanceSource, "manual">,
): VampirePerformancePlan {
	const scenario =
		source === "assistant"
			? ASSISTANT_SCENARIOS.find((candidate) => candidate.pattern.test(message))
			: undefined;
	const intent: EmotionIntent = scenario
		? {
				emotion: scenario.emotion,
				variant: scenario.variant,
				intensity: scenario.intensity,
				contextTags: scenario.contextTags,
				sourceMessage: message,
			}
		: {
				...baseIntent,
				contextTags: [...baseIntent.contextTags],
				sourceMessage: message,
			};
	const expression =
		scenario?.expression ?? expressionForEmotion(intent.emotion);
	const action = resolveAction(message);
	const effects = resolveEffects(message);
	const durationMs = action === "click" ? 260 : action ? 5_600 : 4_600;

	return {
		cue: {
			source,
			scenario: scenario?.id ?? `soullink-${intent.emotion}`,
			intent,
			expression,
			action,
			effects,
			durationMs,
		},
		plan: {
			intent,
			vadTarget: scenario?.vadTarget,
			actionPlan: buildActionPlan(intent.emotion),
			parameterPlan: buildParameterPlan(intent.emotion, message),
			provider: "vampire-native-state-machine",
			replyDraft: source === "assistant" ? message.slice(0, 240) : "",
		},
	};
}
