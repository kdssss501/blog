import {
	CURRENT_SCHEMA_VERSION,
	type EmotionIntent,
	MessageReactionClassifier,
	type ModelProfile,
	motionStylePresets,
	type NativeAnimationDirective,
	type RuntimeSnapshot,
	type SoullinkExternalPlan,
	SoullinkRuntime,
} from "@soullink-emotion/engine";
import type { Live2DMotionParameterInfo } from "@soullink-emotion/live2d-pixi";
import {
	buildVampirePerformancePlan,
	VAMPIRE_ACTION_NEUTRAL_PARAMETERS,
	VAMPIRE_ACTION_PARAMETERS,
	VAMPIRE_COSMETIC_PARAMETERS,
	VAMPIRE_EFFECT_NEUTRAL_PARAMETERS,
	VAMPIRE_EFFECT_PARAMETERS,
	VAMPIRE_VBRIDGER_PARAMETERS,
	type VampireActionName,
	type VampireCosmetics,
	type VampireEffectName,
	type VampireExpressionName,
	type VampirePerformanceSource,
} from "../model/vampire-performance";

export type { VampireCosmetics } from "../model/vampire-performance";

export type XiaoStagePhase =
	| "idle"
	| "listening"
	| "thinking"
	| "streaming"
	| "speaking"
	| "error"
	| "offline";

export interface XiaoStageLoadState {
	mode: "loading" | "live2d" | "fallback";
	label: string;
	detail: string;
	parameterCount?: number;
	maxTextureSize?: number;
}

export interface VampirePerformanceState {
	expression: VampireExpressionName | null;
	action: VampireActionName | null;
	effects: VampireEffectName[];
	source: VampirePerformanceSource | "phase" | "pointer";
	scenario: string;
}

export interface XiaoStageController {
	reactToUserMessage(message: string): EmotionIntent;
	reactToAssistantMessage(message: string): EmotionIntent;
	reactToAssistantVoice(emotion: string, message: string): EmotionIntent;
	applyAssistantPlan(plan: SoullinkExternalPlan): EmotionIntent;
	reactToStageClick(): void;
	setPhase(phase: XiaoStagePhase): void;
	setVoiceLevel(level: number, peak?: number): void;
	setEffectsEnabled(enabled: boolean): void;
	setView(scale: number, offsetX: number, offsetY: number): void;
	setCosmetics(cosmetics: VampireCosmetics): void;
	resetCosmetics(): void;
	/** 传入归一化鼠标坐标 [-0.5, 0.5]，眼睛、头部与数位板会平滑追踪；传 null 恢复 SoulLink idle 控制 */
	setMouseGaze(x: number | null, y: number | null, pressed?: boolean): void;
	triggerExpression(name: VampireExpressionName): void;
	clearExpression(): void;
	triggerAction(name: VampireActionName, durationMs?: number): void;
	clearAction(): void;
	toggleEffect(name: VampireEffectName): void;
	clearEffects(): void;
	getSnapshot(): RuntimeSnapshot;
	getLoadState(): XiaoStageLoadState;
	getPerformanceState(): VampirePerformanceState;
	destroy(): void;
}

interface MountSoullinkStageOptions {
	modelPath: string;
	cubismCorePath: string;
	onLoadState?: (state: XiaoStageLoadState) => void;
	onEmotionChange?: (emotion: string) => void;
	onPerformanceChange?: (state: VampirePerformanceState) => void;
}

interface RendererFacade {
	load(modelUrl: string): Promise<Record<string, Live2DMotionParameterInfo>>;
	setParameters(parameters: Record<string, number>): void;
	readonly suppressedParameterIds: ReadonlySet<string>;
	applyNativeAnimation(directive: NativeAnimationDirective | null): void;
	setViewScale(scale: number): void;
	setViewOffset(offset: { x: number; y: number }): void;
	destroy(): void;
}

interface RendererModelScale {
	x: number;
	y: number;
	set(x: number, y?: number): void;
}

interface RendererViewInternals extends RendererFacade {
	model?: { scale?: RendererModelScale } | null;
	viewScale?: number;
}

interface CubismCoreGlobal {
	Version?: { csmGetLatestMocVersion?: () => number };
}

const cubismCoreLoads = new Map<string, Promise<CubismCoreGlobal>>();

function loadCubismCoreBeforeRenderer(src: string): Promise<CubismCoreGlobal> {
	const current = (window as Window & { Live2DCubismCore?: CubismCoreGlobal })
		.Live2DCubismCore;
	if (current) return Promise.resolve(current);

	const pending = cubismCoreLoads.get(src);
	if (pending) return pending;

	const load = new Promise<CubismCoreGlobal>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = src;
		script.async = true;
		script.dataset.cubismCore = "true";
		script.addEventListener(
			"load",
			() => {
				const core = (
					window as Window & { Live2DCubismCore?: CubismCoreGlobal }
				).Live2DCubismCore;
				if (core) resolve(core);
				else reject(new Error("Cubism Core script loaded without a runtime"));
			},
			{ once: true },
		);
		script.addEventListener(
			"error",
			() => reject(new Error(`Failed to load Cubism Core: ${src}`)),
			{ once: true },
		);
		document.head.append(script);
	}).catch((error) => {
		cubismCoreLoads.delete(src);
		throw error;
	});

	cubismCoreLoads.set(src, load);
	return load;
}

const EXPRESSION_PARAMETERS: Record<string, string[]> = {
	"blood-body": ["PARAMblood1"],
	"blood-face": ["PARAMBLOOD2"],
	circleeyes: ["PARAMWHITEEYE"],
	click: ["Paramclick"],
	hearteyes: ["PARAMhearteye"],
	knife: ["PARAMhands_2", "PARAMhands_1", "PARAMhands_3"],
	mad: ["PARAMANGRY"],
	mc: ["PARAMhands_1", "PARAMhands_2", "PARAMhands_3"],
	mouse: ["PARAMhands_3", "PARAMhands_2", "PARAMhands_1"],
	sad: [
		"PARAMTEARS",
		"PARAM_BROW_L_Y",
		"PARAM_BROW_L_FORM",
		"PARAM_BROW_R_FORM",
		"PARAM_BROW_R_Y",
	],
	shy: ["PARAMSHY"],
	stareyes: ["PARAMstareye"],
};

function buildVampireProfile(modelPath: string): ModelProfile {
	return {
		modelId: "vampire-vts-local",
		displayName: "吸血鬼少女",
		version: "1.0.0",
		modelPath,
		schemaVersion: CURRENT_SCHEMA_VERSION,
		capabilities: {
			headControl: true,
			bodyControl: true,
			eyeBlink: true,
			eyeSmile: true,
			gazeControl: true,
			mouthOpen: true,
			mouthSmile: true,
			browControl: true,
			blush: true,
			tear: true,
			sweat: false,
			breath: true,
		},
		parameterMap: {
			headX: {
				target: "PARAM_ANGLE_X",
				inputRange: [-1, 1],
				outputRange: [-30, 30],
			},
			headY: {
				target: "PARAM_ANGLE_Y",
				inputRange: [-1, 1],
				outputRange: [-30, 30],
			},
			headZ: {
				target: "PARAM_ANGLE_Z",
				inputRange: [-1, 1],
				outputRange: [-30, 30],
			},
			bodyX: {
				target: "PARAM_BODY_ANGLE_X",
				inputRange: [-1, 1],
				outputRange: [-10, 10],
			},
			bodyY: {
				target: "PARAM_BODY_ANGLE_Y",
				inputRange: [-1, 1],
				outputRange: [-10, 10],
			},
			bodyZ: {
				target: "PARAM_BODY_ANGLE_Z",
				inputRange: [-1, 1],
				outputRange: [-10, 10],
			},
			gazeX: { target: "PARAM_EYE_BALL_X", scale: -1, min: -1, max: 1 },
			gazeY: { target: "PARAM_EYE_BALL_Y", min: -1, max: 1 },
			eyeBlinkL: {
				target: "PARAM_EYE_L_OPEN",
				mode: "inverse",
				invertAround: 1,
				min: 0,
				max: 1,
			},
			eyeBlinkR: {
				target: "PARAM_EYE_R_OPEN",
				mode: "inverse",
				invertAround: 1,
				min: 0,
				max: 1,
			},
			eyeSmile: {
				targets: ["PARAM_EYE_L_SMILE", "PARAM_EYE_R_SMILE"],
				min: 0,
				max: 1,
			},
			mouthSmile: {
				target: "PARAM_MOUTH_FORM",
				inputRange: [-1, 1],
				outputRange: [-1, 1],
			},
			mouthFrown: {
				target: "PARAM_MOUTH_FORM",
				mode: "subtract",
				min: -1,
				max: 1,
			},
			mouthOpen: {
				targets: ["PARAM_MOUTH_OPEN_Y", "PARAM_JAW_OPEN"],
				min: 0,
				max: 1,
			},
			mouthPucker: {
				targets: ["PARAMMOUSEFUNNEL", "PARAMMOUSE_PUNKER"],
				min: 0,
				max: 1,
			},
			browInnerUp: {
				targets: ["PARAM_BROW_L_Y", "PARAM_BROW_R_Y"],
				inputRange: [0, 1],
				outputRange: [0, 1.5],
			},
			browOuterUp: {
				targets: ["PARAM_BROW_L_FORM", "PARAM_BROW_R_FORM"],
				min: -1,
				max: 1,
			},
			browDown: {
				targets: ["PARAM_BROW_L_Y", "PARAM_BROW_R_Y"],
				mode: "subtract",
				min: -1,
				max: 1.5,
			},
			breath: { target: "PARAM_BREATH", min: 0, max: 1 },
		},
		customParams: {
			forwardLean: {
				target: VAMPIRE_VBRIDGER_PARAMETERS.forwardLean.id,
				inputRange: [0, 1],
				outputRange: [0, 10],
				min: VAMPIRE_VBRIDGER_PARAMETERS.forwardLean.min,
				max: VAMPIRE_VBRIDGER_PARAMETERS.forwardLean.max,
			},
			mouthShrug: {
				target: VAMPIRE_VBRIDGER_PARAMETERS.mouthShrug.id,
				min: VAMPIRE_VBRIDGER_PARAMETERS.mouthShrug.min,
				max: VAMPIRE_VBRIDGER_PARAMETERS.mouthShrug.max,
			},
			cheekPuff: {
				target: VAMPIRE_VBRIDGER_PARAMETERS.cheekPuff.id,
				min: VAMPIRE_VBRIDGER_PARAMETERS.cheekPuff.min,
				max: VAMPIRE_VBRIDGER_PARAMETERS.cheekPuff.max,
			},
			mouthSkew: {
				target: VAMPIRE_VBRIDGER_PARAMETERS.mouthSkew.id,
				min: VAMPIRE_VBRIDGER_PARAMETERS.mouthSkew.min,
				max: VAMPIRE_VBRIDGER_PARAMETERS.mouthSkew.max,
			},
			lipPress: {
				target: VAMPIRE_VBRIDGER_PARAMETERS.lipPress.id,
				min: VAMPIRE_VBRIDGER_PARAMETERS.lipPress.min,
				max: VAMPIRE_VBRIDGER_PARAMETERS.lipPress.max,
			},
		},
		privateEmotionMap: {
			shy: {
				target: "PARAMSHY",
				category: "blush",
				emotions: ["shy", "affectionate"],
				activeValue: 1,
				neutralValue: 0,
			},
			anger: {
				target: "PARAMANGRY",
				category: "anger",
				emotions: ["anger", "angry"],
				activeValue: 1,
				neutralValue: 0,
			},
			tears: {
				target: "PARAMTEARS",
				category: "tear",
				emotions: ["sad", "concerned", "anxiety"],
				activeValue: 1,
				neutralValue: 0,
			},
			happy: {
				target: "PARAMstareye",
				category: "positiveEye",
				emotions: ["happy", "excited"],
				activeValue: 1,
				neutralValue: 0,
			},
			surprise: {
				target: "PARAMWHITEEYE",
				category: "surprise",
				emotions: ["surprised", "confused"],
				activeValue: 1,
				neutralValue: 0,
			},
		},
		idleConfig: {
			headX: [-0.2, 0.2],
			headY: [-0.12, 0.12],
			headZ: [-0.11, 0.11],
			bodyX: [-0.08, 0.08],
			gazeX: [-0.35, 0.35],
			gazeY: [-0.18, 0.18],
			breath: [0.08, 0.76],
		},
		parameterSmoothing: {
			PARAM_ANGLE_X: 0.14,
			PARAM_ANGLE_Y: 0.14,
			PARAM_ANGLE_Z: 0.13,
			PARAM_BODY_ANGLE_X: 0.1,
			PARAM_MOUTH_OPEN_Y: 0.28,
		},
		nativeAnimations: {
			expressions: Object.entries(EXPRESSION_PARAMETERS).map(
				([name, params]) => ({
					name,
					file: `expressions/${name}.exp3.json`,
					params,
				}),
			),
			motions: [{ group: "Idle", index: 0, file: "motions/idle.motion3.json" }],
		},
		expressionMap: {
			shy: "shy",
			affectionate: "hearteyes",
			happy: "stareyes",
			excited: "stareyes",
			curious: "stareyes",
			surprised: "circleeyes",
			confused: "circleeyes",
			tired: "sad",
			sad: "sad",
			concerned: "sad",
			anxiety: "sad",
			anger: "mad",
			angry: "mad",
		},
		motionMap: {
			tired: { group: "Idle", index: 0, priority: "normal" },
			sad: { group: "Idle", index: 0, priority: "normal" },
			concerned: { group: "Idle", index: 0, priority: "normal" },
			anxiety: { group: "Idle", index: 0, priority: "normal" },
			surprised: { group: "Idle", index: 0, priority: "normal" },
			confused: { group: "Idle", index: 0, priority: "normal" },
		},
	};
}

function maxTextureSize() {
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
	if (!context) return 0;
	const result = context.getParameter(context.MAX_TEXTURE_SIZE) as number;
	context.getExtension("WEBGL_lose_context")?.loseContext();
	return result;
}

function setNumberStyle(target: HTMLElement, name: string, value: number) {
	target.style.setProperty(name, value.toFixed(4));
}

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

export function mountSoullinkStage(
	target: HTMLElement,
	{
		modelPath,
		cubismCorePath,
		onLoadState,
		onEmotionChange,
		onPerformanceChange,
	}: MountSoullinkStageOptions,
): XiaoStageController {
	const voice = {
		level: 0,
		peak: 0,
		sourceAvailable: false,
		getLevel() {
			return this.level;
		},
		getPeak() {
			return this.peak;
		},
		isAvailable() {
			return this.sourceAvailable;
		},
		reset() {
			this.level = 0;
			this.peak = 0;
			this.sourceAvailable = false;
		},
	};
	const profile = buildVampireProfile(modelPath);
	const classifier = new MessageReactionClassifier();
	const runtime = new SoullinkRuntime({
		profile,
		motionStyle: {
			...motionStylePresets.calm,
			seed: 20260725,
			idleActionGain: 0.82,
			microMotionGain: 0.72,
			speechAccentGain: 0.88,
		},
		audioLevelAnalyzer: voice,
	});

	let renderer: RendererFacade | null = null;
	let frame = 0;
	let destroyed = false;
	let stageVisible = true;
	let previousTime = performance.now() / 1000;
	let nativeToken = -1;
	let manualExpressionActive = false;
	let clearExpressionTimer = 0;
	let clearActionTimer = 0;
	let clearAutomaticEffectsTimer = 0;
	let view = { scale: 1, offsetX: 0, offsetY: 0 };
	let previousEmotion = "";
	let voicePlaybackActive = false;
	let voicePlaybackStartedAt = 0;
	let visibleMouthOpen = 0;
	let mouthMinimum = 1;
	let mouthMaximum = 0;
	let jawMinimum = 1;
	let jawMaximum = 0;
	const cosmeticParameterMap = Object.fromEntries(
		Object.entries(VAMPIRE_COSMETIC_PARAMETERS).map(([key, value]) => [
			key,
			value.id,
		]),
	) as Record<keyof VampireCosmetics, string>;
	let cosmetics: VampireCosmetics = {};
	let activeAction: VampireActionName | null = null;
	let activeActionSource: VampirePerformanceState["source"] = "phase";
	let pointerPressed = false;
	const manualEffects = new Set<VampireEffectName>();
	const automaticEffects = new Set<VampireEffectName>();
	let performanceState: VampirePerformanceState = {
		expression: null,
		action: null,
		effects: [],
		source: "phase",
		scenario: "idle",
	};

	const applyRendererAnimation = (
		directive: NativeAnimationDirective | null,
	) => {
		if (!renderer) return;
		renderer.applyNativeAnimation(directive);
		target.dataset.nativeAnimationExpression = directive?.expression ?? "none";
		target.dataset.nativeAnimationMotion = directive?.motion
			? `${directive.motion.group}:${directive.motion.index ?? 0}`
			: "none";
		target.dataset.nativeSuppressedParameters =
			[...renderer.suppressedParameterIds].sort().join(",") || "none";
	};

	const publishPerformanceState = () => {
		target.dataset.performanceExpression =
			performanceState.expression ?? "none";
		target.dataset.performanceAction = performanceState.action ?? "none";
		target.dataset.performanceEffects =
			performanceState.effects.join(",") || "none";
		target.dataset.performanceSource = performanceState.source;
		target.dataset.performanceScenario = performanceState.scenario;
		onPerformanceChange?.({
			...performanceState,
			effects: [...performanceState.effects],
		});
	};

	const updatePerformanceState = (patch: Partial<VampirePerformanceState>) => {
		performanceState = { ...performanceState, ...patch };
		publishPerformanceState();
	};

	// 鼠标眼球追踪：smoothed 值每帧以 lerp 渐近目标
	let mouseGazeTarget: { x: number; y: number } | null = null;
	const mouseGazeSmoothed = { x: 0, y: 0 };
	let mouseGazeDecay = 0; // > 0 时逐渐归还控制权给 SoulLink
	let loadState: XiaoStageLoadState = {
		mode: "loading",
		label: "正在连接模型",
		detail: "检查 Cubism 运行环境",
	};

	const setLoadState = (state: XiaoStageLoadState) => {
		loadState = state;
		target.dataset.modelMode = state.mode;
		target.dataset.modelLabel = state.label;
		onLoadState?.(state);
	};

	const motionProperties = [
		"--xiao-breath",
		"--xiao-head-x",
		"--xiao-head-y",
		"--xiao-head-z",
		"--xiao-gaze-x",
		"--xiao-gaze-y",
		"--xiao-smile",
		"--xiao-valence",
		"--xiao-arousal",
		"--xiao-dominance",
	];

	const applySnapshot = (snapshot: RuntimeSnapshot, deltaSeconds = 0) => {
		const { facs, vad } = snapshot;
		setNumberStyle(target, "--xiao-breath", facs.breath);
		setNumberStyle(target, "--xiao-head-x", facs.headX);
		setNumberStyle(target, "--xiao-head-y", facs.headY);
		setNumberStyle(target, "--xiao-head-z", facs.headZ);
		setNumberStyle(target, "--xiao-gaze-x", facs.gazeX);
		setNumberStyle(target, "--xiao-gaze-y", facs.gazeY);
		setNumberStyle(target, "--xiao-smile", facs.mouthSmile);
		setNumberStyle(target, "--xiao-valence", (vad.current.valence + 1) / 2);
		setNumberStyle(target, "--xiao-arousal", (vad.current.arousal + 1) / 2);
		setNumberStyle(target, "--xiao-dominance", (vad.current.dominance + 1) / 2);
		const emotion =
			snapshot.emotionIntent?.emotion ?? vad.dominantEmotion ?? "neutral";
		target.dataset.emotion = emotion;
		if (emotion !== previousEmotion) {
			previousEmotion = emotion;
			onEmotionChange?.(emotion);
		}

		const params: Record<string, number> = { ...snapshot.live2dParams };
		for (const [key, parameterId] of Object.entries(
			cosmeticParameterMap,
		) as Array<[keyof VampireCosmetics, string]>) {
			const value = cosmetics[key];
			if (value !== undefined) params[parameterId] = value;
		}

		Object.assign(params, VAMPIRE_ACTION_NEUTRAL_PARAMETERS);
		if (activeAction) {
			Object.assign(params, VAMPIRE_ACTION_PARAMETERS[activeAction]);
		}
		Object.assign(params, VAMPIRE_EFFECT_NEUTRAL_PARAMETERS);
		for (const effect of new Set([...manualEffects, ...automaticEffects])) {
			Object.assign(params, VAMPIRE_EFFECT_PARAMETERS[effect]);
		}

		// 鼠标眼球追踪：平滑插值，优先级高于 SoulLink idle gaze
		if (mouseGazeTarget !== null) {
			const lerpSpeed = 0.12;
			mouseGazeSmoothed.x +=
				(mouseGazeTarget.x - mouseGazeSmoothed.x) * lerpSpeed;
			mouseGazeSmoothed.y +=
				(mouseGazeTarget.y - mouseGazeSmoothed.y) * lerpSpeed;
			// 鼠标为舞台坐标，Y 轴需翻转为 Cubism 的向上正方向。
			params.PARAM_EYE_BALL_X = Math.min(
				1,
				Math.max(-1, mouseGazeSmoothed.x * 2),
			);
			params.PARAM_EYE_BALL_Y = Math.min(
				1,
				Math.max(-1, -mouseGazeSmoothed.y * 2),
			);
			params.PARAM_ANGLE_X = Math.min(
				30,
				Math.max(-30, (params.PARAM_ANGLE_X ?? 0) + mouseGazeSmoothed.x * 9),
			);
			params.PARAM_ANGLE_Y = Math.min(
				30,
				Math.max(-30, (params.PARAM_ANGLE_Y ?? 0) - mouseGazeSmoothed.y * 7),
			);
			if (activeAction === "mouse") {
				params.ParammouseX = Math.min(1, Math.max(-1, mouseGazeSmoothed.x * 2));
				params.ParammouseY = Math.min(
					1,
					Math.max(-1, -mouseGazeSmoothed.y * 2),
				);
				params.Paramclick = pointerPressed ? 1 : 0;
			}
		} else if (mouseGazeDecay > 0) {
			mouseGazeDecay = Math.max(0, mouseGazeDecay - (deltaSeconds || 0.016));
			const blend = mouseGazeDecay / 2.0;
			mouseGazeSmoothed.x *= 0.92;
			mouseGazeSmoothed.y *= 0.92;
			if (blend > 0) {
				params.PARAM_EYE_BALL_X = Math.min(
					1,
					Math.max(-1, mouseGazeSmoothed.x * 2 * blend),
				);
				params.PARAM_EYE_BALL_Y = Math.min(
					1,
					Math.max(-1, -mouseGazeSmoothed.y * 2 * blend),
				);
				params.PARAM_ANGLE_X = Math.min(
					30,
					Math.max(
						-30,
						(params.PARAM_ANGLE_X ?? 0) + mouseGazeSmoothed.x * 9 * blend,
					),
				);
				params.PARAM_ANGLE_Y = Math.min(
					30,
					Math.max(
						-30,
						(params.PARAM_ANGLE_Y ?? 0) - mouseGazeSmoothed.y * 7 * blend,
					),
				);
				if (activeAction === "mouse") {
					params.ParammouseX = Math.min(
						1,
						Math.max(-1, mouseGazeSmoothed.x * 2 * blend),
					);
					params.ParammouseY = Math.min(
						1,
						Math.max(-1, -mouseGazeSmoothed.y * 2 * blend),
					);
					params.Paramclick = 0;
				}
			}
		}

		if (voicePlaybackActive) {
			const elapsed = Math.max(
				0,
				window.performance.now() / 1000 - voicePlaybackStartedAt,
			);
			const timedPulse = clampUnit(
				0.5 +
					Math.sin(elapsed * 18.6) * 0.34 +
					Math.sin(elapsed * 31.4 + 0.7) * 0.16,
			);
			const measuredLevel = clampUnit(
				Math.max(voice.level * 1.3, voice.peak * 0.72),
			);
			const hasMeasuredSignal =
				voice.sourceAvailable && (voice.level > 0.012 || voice.peak > 0.026);
			const calibratedTarget = hasMeasuredSignal
				? clampUnit(0.1 + measuredLevel * 0.78)
				: 0.08 + timedPulse * 0.38;
			const targetOpen = Math.max(
				params.PARAM_MOUTH_OPEN_Y ?? 0,
				calibratedTarget,
			);
			const responseSeconds = targetOpen >= visibleMouthOpen ? 0.032 : 0.072;
			const response = 1 - Math.exp(-(deltaSeconds || 0.016) / responseSeconds);
			visibleMouthOpen += (targetOpen - visibleMouthOpen) * response;
			const jawOpen = Math.max(
				params[VAMPIRE_VBRIDGER_PARAMETERS.jawOpen.id] ?? 0,
				visibleMouthOpen * 0.58,
			);
			params.PARAM_MOUTH_OPEN_Y = visibleMouthOpen;
			params[VAMPIRE_VBRIDGER_PARAMETERS.jawOpen.id] = jawOpen;
			mouthMinimum = Math.min(mouthMinimum, visibleMouthOpen);
			mouthMaximum = Math.max(mouthMaximum, visibleMouthOpen);
			jawMinimum = Math.min(jawMinimum, jawOpen);
			jawMaximum = Math.max(jawMaximum, jawOpen);
			target.dataset.lipsyncSource = hasMeasuredSignal
				? "audio"
				: "timed-fallback";
		} else {
			visibleMouthOpen = 0;
			target.dataset.lipsyncSource = "idle";
		}
		const publishParameter = (name: string, value: number | undefined) => {
			target.dataset[name] = Number.isFinite(value)
				? Number(value).toFixed(4)
				: "0.0000";
		};
		publishParameter("nativeEyeX", params.PARAM_EYE_BALL_X);
		publishParameter("nativeEyeY", params.PARAM_EYE_BALL_Y);
		publishParameter("nativeHeadX", params.PARAM_ANGLE_X);
		publishParameter("nativeHeadY", params.PARAM_ANGLE_Y);
		publishParameter("nativeMouthOpen", params.PARAM_MOUTH_OPEN_Y);
		publishParameter("nativeMouthForm", params.PARAM_MOUTH_FORM);
		publishParameter("nativeBrowLY", params.PARAM_BROW_L_Y);
		publishParameter("nativeBrowRY", params.PARAM_BROW_R_Y);
		publishParameter("nativeBrowLForm", params.PARAM_BROW_L_FORM);
		publishParameter("nativeBrowRForm", params.PARAM_BROW_R_FORM);
		publishParameter("nativeMouseX", params.ParammouseX);
		publishParameter("nativeMouseY", params.ParammouseY);
		publishParameter("nativeClick", params.Paramclick);
		publishParameter("nativeHandsMc", params.PARAMhands_1);
		publishParameter("nativeHandsKnife", params.PARAMhands_2);
		publishParameter("nativeHandsTablet", params.PARAMhands_3);
		publishParameter("nativeBloodFace", params.PARAMBLOOD2);
		publishParameter("nativeBloodBody", params.PARAMblood1);
		publishParameter(
			"nativeForwardLean",
			params[VAMPIRE_VBRIDGER_PARAMETERS.forwardLean.id],
		);
		publishParameter(
			"nativeMouthShrug",
			params[VAMPIRE_VBRIDGER_PARAMETERS.mouthShrug.id],
		);
		publishParameter(
			"nativeCheekPuff",
			params[VAMPIRE_VBRIDGER_PARAMETERS.cheekPuff.id],
		);
		publishParameter(
			"nativeMouthSkew",
			params[VAMPIRE_VBRIDGER_PARAMETERS.mouthSkew.id],
		);
		publishParameter(
			"nativeLipPress",
			params[VAMPIRE_VBRIDGER_PARAMETERS.lipPress.id],
		);
		publishParameter(
			"nativeMouthFunnel",
			params[VAMPIRE_VBRIDGER_PARAMETERS.mouthFunnel.id],
		);
		publishParameter(
			"nativeMouthPucker",
			params[VAMPIRE_VBRIDGER_PARAMETERS.mouthPucker.id],
		);
		publishParameter(
			"nativeJawOpen",
			params[VAMPIRE_VBRIDGER_PARAMETERS.jawOpen.id],
		);
		publishParameter("voiceLevel", voice.level);
		publishParameter("voicePeak", voice.peak);
		publishParameter(
			"mouthMinimum",
			mouthMinimum <= mouthMaximum ? mouthMinimum : 0,
		);
		publishParameter("mouthMaximum", mouthMaximum);
		publishParameter("jawMinimum", jawMinimum <= jawMaximum ? jawMinimum : 0);
		publishParameter("jawMaximum", jawMaximum);
		target.dataset.soullinkParameterBeats = String(
			snapshot.plan?.parameterBeatCount ?? 0,
		);

		renderer?.setParameters(params);

		const directive = snapshot.nativeAnimation;
		if (
			renderer &&
			!manualExpressionActive &&
			directive !== null &&
			directive.token !== nativeToken
		) {
			applyRendererAnimation(directive);
			nativeToken = directive.token;
		}
	};

	const stopAnimation = () => {
		if (!frame) return;
		window.cancelAnimationFrame(frame);
		frame = 0;
	};

	const scheduleAnimation = () => {
		if (destroyed || !stageVisible || frame) return;
		previousTime = performance.now() / 1000;
		frame = window.requestAnimationFrame(animationTick);
	};

	const animationTick = (timeMs: number) => {
		frame = 0;
		if (destroyed || !stageVisible) return;
		const now = timeMs / 1000;
		const delta = Math.min(0.05, Math.max(0.001, now - previousTime));
		previousTime = now;
		applySnapshot(runtime.update(now, delta), delta);
		scheduleAnimation();
	};

	const applyView = () => {
		if (!renderer) return;
		renderer.setViewScale(view.scale);
		renderer.setViewOffset({
			x: view.offsetX * target.clientWidth,
			y: view.offsetY * target.clientHeight,
		});

		// SoulLink beta 当前会把镜头缩放限制在 2.2。近景需要更紧的构图，
		// 因而在它完成自适应布局后，仅补足被限制掉的模型缩放倍率。
		const internal = renderer as RendererViewInternals;
		const appliedScale = internal.viewScale;
		const modelScale = internal.model?.scale;
		if (
			modelScale &&
			typeof appliedScale === "number" &&
			appliedScale > 0 &&
			Math.abs(view.scale - appliedScale) > 0.001
		) {
			const ratio = view.scale / appliedScale;
			modelScale.set(modelScale.x * ratio, modelScale.y * ratio);
		}
	};

	const resizeRenderer = () => {
		if (!renderer) return;
		const internalRenderer = renderer as RendererFacade & {
			app?: { renderer?: { resize?: (width: number, height: number) => void } };
		};
		const width = Math.max(1, Math.round(target.clientWidth));
		const height = Math.max(1, Math.round(target.clientHeight));
		internalRenderer.app?.renderer?.resize?.(width, height);
		applyView();
	};

	const emptyDirective = (): NativeAnimationDirective => ({
		token: ++nativeToken,
		expression: null,
		motion: null,
		suppressParamIds: [],
	});

	const clearExpression = () => {
		if (clearExpressionTimer) window.clearTimeout(clearExpressionTimer);
		clearExpressionTimer = 0;
		if (renderer) {
			applyRendererAnimation(emptyDirective());
			const runtimeToken = runtime.getSnapshot().nativeAnimation?.token;
			if (typeof runtimeToken === "number") nativeToken = runtimeToken;
		}
		manualExpressionActive = false;
		updatePerformanceState({ expression: null });
	};

	const clearAction = () => {
		if (clearActionTimer) window.clearTimeout(clearActionTimer);
		clearActionTimer = 0;
		activeAction = null;
		activeActionSource = "phase";
		pointerPressed = false;
		updatePerformanceState({ action: null });
		applySnapshot(runtime.getSnapshot());
	};

	const setActiveAction = (
		name: VampireActionName,
		durationMs = 0,
		source: VampirePerformanceState["source"] = "manual",
	) => {
		if (clearActionTimer) window.clearTimeout(clearActionTimer);
		clearActionTimer = 0;
		activeAction = name;
		activeActionSource = source;
		updatePerformanceState({ action: name, source });
		applySnapshot(runtime.getSnapshot());
		if (durationMs > 0) {
			clearActionTimer = window.setTimeout(() => {
				if (activeAction === name && activeActionSource === source)
					clearAction();
			}, durationMs);
		}
	};

	const syncEffectsState = (
		source: VampirePerformanceState["source"] = "manual",
	) => {
		updatePerformanceState({
			effects: [...new Set([...manualEffects, ...automaticEffects])],
			source,
		});
		applySnapshot(runtime.getSnapshot());
	};

	const clearAutomaticEffects = () => {
		if (clearAutomaticEffectsTimer) {
			window.clearTimeout(clearAutomaticEffectsTimer);
		}
		clearAutomaticEffectsTimer = 0;
		automaticEffects.clear();
		syncEffectsState(performanceState.source);
	};

	const applyPerformanceCue = (
		performance: ReturnType<typeof buildVampirePerformancePlan>,
	) => {
		const { cue } = performance;
		const manualActionActive =
			activeAction !== null && activeActionSource === "manual";
		const performanceSource =
			manualExpressionActive || manualActionActive || manualEffects.size > 0
				? "manual"
				: cue.source;
		updatePerformanceState({
			expression: manualExpressionActive
				? performanceState.expression
				: cue.expression,
			source: performanceSource,
			scenario: cue.scenario,
		});
		if (cue.expression && !manualExpressionActive) {
			if (clearExpressionTimer) window.clearTimeout(clearExpressionTimer);
			clearExpressionTimer = window.setTimeout(clearExpression, cue.durationMs);
		}
		if (cue.action && !manualActionActive) {
			setActiveAction(cue.action, cue.durationMs, cue.source);
		} else if (!cue.action && !manualActionActive) {
			clearAction();
		}

		if (clearAutomaticEffectsTimer) {
			window.clearTimeout(clearAutomaticEffectsTimer);
		}
		automaticEffects.clear();
		for (const effect of cue.effects) automaticEffects.add(effect);
		if (automaticEffects.size > 0) {
			clearAutomaticEffectsTimer = window.setTimeout(
				clearAutomaticEffects,
				cue.durationMs,
			);
		}
		syncEffectsState(performanceSource);
	};

	const runPerformancePlan = (
		plannedPerformance: ReturnType<typeof buildVampirePerformancePlan>,
		plan: SoullinkExternalPlan = plannedPerformance.plan,
	) => {
		const now = window.performance.now() / 1000;
		const intent = runtime.triggerPlan(plan, now);
		if (plan.parameterPlan?.length) {
			const motionDuration =
				Math.max(
					...plan.parameterPlan.map((beat) => beat.time + beat.duration),
				) + 0.2;
			runtime.startSpeechMotion(plan.parameterPlan, now, motionDuration);
		}
		applyPerformanceCue(plannedPerformance);
		applySnapshot(runtime.update(now, 0.016));
		return intent;
	};

	const reactToMessage = (
		message: string,
		source: Exclude<VampirePerformanceSource, "manual">,
	) => {
		const plannedPerformance = buildVampirePerformancePlan(
			classifier.classify(message),
			message,
			source,
		);
		return runPerformancePlan(plannedPerformance);
	};

	const initializeRenderer = async () => {
		if (!modelPath || !cubismCorePath) {
			setLoadState({
				mode: "fallback",
				label: "本地模型尚未连接",
				detail: "配置模型目录与 Cubism 5 Core 后即可加载",
			});
			return;
		}
		const textureLimit = maxTextureSize();
		if (textureLimit < 4096) {
			setLoadState({
				mode: "fallback",
				label: "显卡纹理上限不足",
				detail: `当前上限 ${textureLimit || "未知"}，网页模型需要 4096`,
				maxTextureSize: textureLimit,
			});
			return;
		}

		try {
			const core = await loadCubismCoreBeforeRenderer(cubismCorePath);
			const latestMocVersion =
				core.Version?.csmGetLatestMocVersion?.() ?? 0;
			if (latestMocVersion < 5) {
				throw new Error(
					`Cubism Core does not support MOC3 v5 (${latestMocVersion})`,
				);
			}
			const { Live2DRenderer } = await import(
				"@soullink-emotion/live2d-pixi"
			);
			if (destroyed) return;
			const missingParameters = new Set<string>();
			renderer = new Live2DRenderer(target, {
				cubismLoader: async () => {},
				onMissingParameter: (id) => {
					missingParameters.add(id);
					target.dataset.missingParameterCount = String(missingParameters.size);
				},
			}) as RendererFacade;
			const parameters = await renderer.load(modelPath);
			if (destroyed) {
				renderer.destroy();
				renderer = null;
				return;
			}
			runtime.setPrivateVADParameters(parameters);
			applyRendererAnimation(emptyDirective());
			applyView();
			applySnapshot(runtime.getSnapshot());
			target.dataset.missingParameterCount = String(missingParameters.size);
			setLoadState({
				mode: "live2d",
				label: "SoulLink 已接管",
				detail: `${Object.keys(parameters).length} 个参数 · 4 张 4096 网页纹理`,
				parameterCount: Object.keys(parameters).length,
				maxTextureSize: textureLimit,
			});
		} catch (error) {
			renderer?.destroy();
			renderer = null;
			const detail = error instanceof Error ? error.message : "未知加载错误";
			setLoadState({
				mode: "fallback",
				label: "Live2D 加载失败",
				detail,
				maxTextureSize: textureLimit,
			});
		}
	};

	const visibilityObserver = new IntersectionObserver(([entry]) => {
		stageVisible = entry?.isIntersecting ?? true;
		if (stageVisible) scheduleAnimation();
		else stopAnimation();
	});
	visibilityObserver.observe(target);

	// 同步 Pixi backing canvas 与 CSS 容器，避免布局变化时只拉伸旧画布。
	const sizeObserver = new ResizeObserver(() => {
		if (!destroyed) resizeRenderer();
	});
	sizeObserver.observe(target);

	setLoadState(loadState);
	publishPerformanceState();
	applySnapshot(runtime.getSnapshot());
	scheduleAnimation();
	void initializeRenderer();

	return {
		reactToUserMessage(message) {
			return reactToMessage(message, "user");
		},
		reactToAssistantMessage(message) {
			return reactToMessage(message, "assistant");
		},
		reactToAssistantVoice(emotion, message) {
			const classified = classifier.classify(message);
			const normalizedEmotion = /^[a-z][a-z-]{1,31}$/i.test(emotion)
				? emotion.toLowerCase()
				: classified.emotion;
			const intent: EmotionIntent = {
				...classified,
				emotion: normalizedEmotion,
				variant: `voice-${normalizedEmotion}`,
				intensity: Math.max(0.72, classified.intensity),
				contextTags: [
					...new Set([...classified.contextTags, "voice", "gpt-sovits"]),
				],
				sourceMessage: message,
			};
			return runPerformancePlan(
				buildVampirePerformancePlan(intent, message, "assistant"),
			);
		},
		applyAssistantPlan(plan) {
			const plannedPerformance = buildVampirePerformancePlan(
				plan.intent,
				plan.replyDraft ?? plan.intent.sourceMessage ?? "",
				"assistant",
			);
			return runPerformancePlan(plannedPerformance, {
				...plannedPerformance.plan,
				...plan,
				intent: plannedPerformance.plan.intent,
				vadTarget: plan.vadTarget ?? plannedPerformance.plan.vadTarget,
				actionPlan: plan.actionPlan ?? plannedPerformance.plan.actionPlan,
				parameterPlan:
					plan.parameterPlan ?? plannedPerformance.plan.parameterPlan,
				provider: plan.provider ?? plannedPerformance.plan.provider,
				replyDraft: plan.replyDraft ?? plannedPerformance.plan.replyDraft,
			});
		},
		reactToStageClick() {
			runtime.applyVADDelta({ arousal: 0.12, dominance: 0.04 }, 0.7);
		},
		setPhase(phase) {
			target.dataset.phase = phase;
			const speaking = phase === "speaking";
			if (speaking && !voicePlaybackActive) {
				voicePlaybackStartedAt = window.performance.now() / 1000;
				visibleMouthOpen = 0;
				mouthMinimum = 1;
				mouthMaximum = 0;
				jawMinimum = 1;
				jawMaximum = 0;
			}
			voicePlaybackActive = speaking;
			runtime.setVoicePlaybackActive(speaking);
			if (speaking && activeAction === null) {
				setActiveAction("mc", 0, "phase");
			} else if (
				phase === "thinking" &&
				(activeAction === null || activeActionSource !== "manual")
			) {
				setActiveAction("mouse", 0, "phase");
			} else if (activeActionSource === "phase") {
				clearAction();
			}
			if (phase === "thinking") {
				runtime.startVoiceWaitingMotion(performance.now() / 1000);
			} else if (phase === "idle" || phase === "error" || phase === "offline") {
				runtime.clearVoiceWaitingMotion();
				if (!speaking) voice.reset();
			}
		},
		setVoiceLevel(level, peak = level) {
			voice.level = Math.min(1, Math.max(0, level));
			voice.peak = Math.min(1, Math.max(voice.level, peak));
			voice.sourceAvailable = true;
		},
		setEffectsEnabled(enabled) {
			target.dataset.effects = enabled ? "on" : "off";
			applySnapshot(runtime.getSnapshot());
			scheduleAnimation();
		},
		setView(scale, offsetX, offsetY) {
			view = { scale, offsetX, offsetY };
			applyView();
		},
		setCosmetics(next) {
			const clamped: VampireCosmetics = {};
			for (const [key, value] of Object.entries(next) as Array<
				[keyof typeof VAMPIRE_COSMETIC_PARAMETERS, number | undefined]
			>) {
				const definition = VAMPIRE_COSMETIC_PARAMETERS[key];
				if (
					!definition ||
					typeof value !== "number" ||
					!Number.isFinite(value)
				) {
					continue;
				}
				clamped[key] = Math.min(
					definition.max,
					Math.max(definition.min, value),
				);
			}
			cosmetics = { ...cosmetics, ...clamped };
			if ((cosmetics.bangsStyle ?? 0) >= 0.5) cosmetics.hairpin2 = 0;
			target.dataset.cosmetics = JSON.stringify(cosmetics);
			applySnapshot(runtime.getSnapshot());
		},
		resetCosmetics() {
			cosmetics = Object.fromEntries(
				Object.entries(VAMPIRE_COSMETIC_PARAMETERS).map(([key, definition]) => [
					key,
					definition.default,
				]),
			) as VampireCosmetics;
			target.dataset.cosmetics = JSON.stringify(cosmetics);
			applySnapshot(runtime.getSnapshot());
		},
		setMouseGaze(x, y, pressed = false) {
			if (x === null || y === null) {
				// 开始2秒归零衰减
				mouseGazeTarget = null;
				mouseGazeDecay = 2.0;
				pointerPressed = false;
				target.dataset.pointerActive = "false";
				target.dataset.pointerPressed = "false";
			} else {
				mouseGazeTarget = { x, y };
				mouseGazeDecay = 0;
				pointerPressed = pressed;
				target.dataset.pointerActive = "true";
				target.dataset.pointerPressed = pressed ? "true" : "false";
			}
		},
		triggerExpression(name) {
			if (!EXPRESSION_PARAMETERS[name]) return;
			if (clearExpressionTimer) window.clearTimeout(clearExpressionTimer);
			manualExpressionActive = true;
			applyRendererAnimation({
				token: ++nativeToken,
				expression: name,
				motion: null,
				suppressParamIds: EXPRESSION_PARAMETERS[name],
			});
			updatePerformanceState({
				expression: name,
				source: "manual",
				scenario: `manual-${name}`,
			});
			clearExpressionTimer = window.setTimeout(clearExpression, 5_600);
		},
		clearExpression,
		triggerAction(name, durationMs = 5_600) {
			setActiveAction(name, durationMs, "manual");
		},
		clearAction,
		toggleEffect(name) {
			if (manualEffects.has(name)) manualEffects.delete(name);
			else manualEffects.add(name);
			syncEffectsState("manual");
		},
		clearEffects() {
			manualEffects.clear();
			clearAutomaticEffects();
		},
		getSnapshot() {
			return runtime.getSnapshot();
		},
		getLoadState() {
			return { ...loadState };
		},
		getPerformanceState() {
			return { ...performanceState, effects: [...performanceState.effects] };
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			stopAnimation();
			visibilityObserver.disconnect();
			sizeObserver.disconnect();
			if (clearExpressionTimer) window.clearTimeout(clearExpressionTimer);
			if (clearActionTimer) window.clearTimeout(clearActionTimer);
			if (clearAutomaticEffectsTimer) {
				window.clearTimeout(clearAutomaticEffectsTimer);
			}
			runtime.setVoicePlaybackActive(false);
			runtime.clearVoiceWaitingMotion();
			voice.reset();
			renderer?.destroy();
			renderer = null;
			for (const property of motionProperties) {
				target.style.removeProperty(property);
			}
			delete target.dataset.phase;
			delete target.dataset.emotion;
			delete target.dataset.modelMode;
			delete target.dataset.modelLabel;
			delete target.dataset.effects;
			delete target.dataset.cosmetics;
			delete target.dataset.performanceExpression;
			delete target.dataset.performanceAction;
			delete target.dataset.performanceEffects;
			delete target.dataset.performanceSource;
			delete target.dataset.performanceScenario;
			delete target.dataset.pointerActive;
			delete target.dataset.pointerPressed;
			delete target.dataset.nativeEyeX;
			delete target.dataset.nativeEyeY;
			delete target.dataset.nativeHeadX;
			delete target.dataset.nativeHeadY;
			delete target.dataset.nativeMouthOpen;
			delete target.dataset.nativeMouthForm;
			delete target.dataset.nativeMouseX;
			delete target.dataset.nativeMouseY;
			delete target.dataset.nativeClick;
		},
	};
}
