<script lang="ts">
import { onMount, tick } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { VampireIntroConfig } from "@/config/xiaoConfig";
import {
	type AIChatMessage,
	createAIChatController,
	type XiaoAssistantStatus,
} from "@/features/search";
import {
	resolveCharacterCamera,
	type VampireCameraMode,
} from "../client/camera-rig";
import {
	type GothicStageCanvasController,
	mountGothicStageCanvas,
} from "../client/gothic-stage-canvas";
import {
	mountSoullinkStage,
	type VampirePerformanceState,
	type XiaoStageController,
	type XiaoStageLoadState,
} from "../client/soullink-stage";
import {
	createVampireVoicePlayer,
	type VampireVoiceState,
} from "../client/vampire-voice-player";
import {
	VAMPIRE_ACTION_CONTROLS,
	VAMPIRE_COSMETIC_PARAMETERS,
	VAMPIRE_EFFECT_CONTROLS,
	VAMPIRE_EXPRESSION_CONTROLS,
	type VampireActionName,
	type VampireCosmeticKey,
	type VampireCosmetics,
	type VampireEffectName,
	type VampireExpressionName,
} from "../model/vampire-performance";
import VampireChibiReaction from "./VampireChibiReaction.svelte";
import VampireChainIntro from "./VampireChainIntro.svelte";
import { VAMPIRE_INTRO_SESSION_KEY } from "../model/vampire-intro-timeline";

interface Props {
	intro?: VampireIntroConfig;
	background: string;
	effectsAtlas: string;
	envelopeSequenceAtlas: string;
	modelPath?: string;
	cubismCorePath?: string;
}

type MobileView = "stage" | "chat";
type ChibiExpression = "happy" | "shy" | "startled";
type ChibiPhase =
	| "reaction"
	| "thinking"
	| "generating"
	| "buffering"
	| "playing"
	| "complete";
type VampireMode = "normal" | "white" | "custom";
type PonytailStyle = "none" | "left" | "right" | "double";
type CosmeticState = Record<VampireCosmeticKey, number>;

const STATUS_LABELS: Record<XiaoAssistantStatus, string> = {
	idle: "在这里",
	listening: "正在听",
	thinking: "正在想",
	streaming: "正在回答",
	speaking: "正在说话",
	error: "连接异常",
	offline: "暂时离线",
};

const VOICE_PHASE_LABELS: Record<VampireVoiceState["phase"], string> = {
	idle: "语音待命",
	queued: "语音排队中",
	generating: "正在生成日语语音",
	buffering: "正在缓冲音频",
	playing: "正在播放",
	complete: "语音已就绪",
	error: "语音生成失败",
};

const QUICK_PROMPTS = [
	"今晚想听我说什么？",
	"替我读一段最近的文字",
	"陪我聊聊今天没有说出口的事",
	"给今晚留下一封短信",
];

const CAMERA_OPTIONS: Array<{
	id: VampireCameraMode;
	label: string;
	icon: string;
}> = [
	{
		id: "wide",
		label: "广角",
		icon: "material-symbols:fit-screen-outline-rounded",
	},
	{
		id: "portrait",
		label: "半身",
		icon: "material-symbols:portrait-outline-rounded",
	},
	{ id: "closeup", label: "近景", icon: "material-symbols:zoom-in-rounded" },
];

const EXPRESSIONS = VAMPIRE_EXPRESSION_CONTROLS;
const ACTIONS = VAMPIRE_ACTION_CONTROLS;
const MODEL_EFFECTS = VAMPIRE_EFFECT_CONTROLS;
const COLOR_CONTROLS = [
	{ key: "hairWhite", label: "发色" },
	{ key: "accessoryWhite", label: "发饰" },
	{ key: "outfitWhite", label: "服装" },
] as const;
const HAIRPIN_CONTROLS = [
	{ key: "hairpin1", label: "创口贴" },
	{ key: "hairpin2", label: "环形" },
	{ key: "hairpin3", label: "十字架" },
] as const;
const LENGTH_CONTROLS = [
	{ key: "sideHairLength", label: "侧发" },
	{ key: "ponytailLength", label: "马尾" },
	{ key: "longHairLength", label: "长发" },
] as const;

const EFFECTS_STORAGE_KEY = "blog:vampire:effects";
const SOUND_STORAGE_KEY = "blog:vampire:sound";
const COSMETICS_STORAGE_KEY = "blog:vampire:cosmetics:v1";

function createDefaultCosmetics(): CosmeticState {
	return Object.fromEntries(
		Object.entries(VAMPIRE_COSMETIC_PARAMETERS).map(([key, definition]) => [
			key,
			definition.default,
		]),
	) as CosmeticState;
}

function resolvePonytailStyle(state: CosmeticState): PonytailStyle {
	if (state.ponytails < 0.5) return "none";
	if (state.ponytailLeft >= 0.5 && state.ponytailRight >= 0.5) return "double";
	if (state.ponytailLeft >= 0.5) return "left";
	if (state.ponytailRight >= 0.5) return "right";
	return "none";
}

let {
	intro,
	background,
	effectsAtlas,
	envelopeSequenceAtlas,
	modelPath = "",
	cubismCorePath = "",
}: Props = $props();

const chat = createAIChatController({
	assistant: "vampire",
	mode: "vampire",
	storageNamespace: "ai-chat:vampire",
	maxInputLength: 1000,
});

let workspace: HTMLElement;
let scene: HTMLElement;
let stage: HTMLElement;
let live2dHost: HTMLElement;
let backdropCanvas: HTMLCanvasElement;
let effectsCanvas: HTMLCanvasElement;
let transcript: HTMLElement;
let composer: HTMLTextAreaElement;
let stageController: XiaoStageController | null = null;
let canvasController: GothicStageCanvasController | null = null;
let voicePlayer: ReturnType<typeof createVampireVoicePlayer> | null = null;
let draft = $state("");
let mobileView = $state<MobileView>("stage");
let cameraMode = $state<VampireCameraMode>("wide");
let effectsEnabled = $state(true);
let soundEnabled = $state(false);
let historyOpen = $state(false);
let expressionOpen = $state(false);
let settingsOpen = $state(false);
let chatHidden = $state(false);
let toolbarIntro = $state(true);
let introPlaying = $state(Boolean(intro));
let introRun = $state(0);
let returnHintVisible = $state(false);
let returnTouchStartY: number | null = null;
let returnTouchHandled = false;
let fullscreenActive = $state(false);
let beijingTime = $state("");
let lastSubmittedMessage = $state("");
let vampireMode = $state<VampireMode>("normal");
let customizeOpen = $state(false);
let chibiVisible = $state(false);
let chibiExpression = $state<ChibiExpression>("happy");
let chibiToken = $state(0);
let chibiPhase = $state<ChibiPhase>("reaction");
let modelState = $state<XiaoStageLoadState>({
	mode: "loading",
	label: "正在连接模型",
	detail: "检查 Cubism 运行环境",
});
let performanceState = $state<VampirePerformanceState>({
	expression: null,
	action: null,
	effects: [],
	source: "phase",
	scenario: "idle",
});
let voiceState = $state<VampireVoiceState>({
	messageId: "",
	speechJa: "",
	emotion: "neutral",
	phase: "idle",
	progress: 0,
	error: null,
});
let cosmetics = $state<CosmeticState>(createDefaultCosmetics());
let ponytailStyle = $derived(resolvePonytailStyle(cosmetics));

const statusLabel = $derived(STATUS_LABELS[$chat.status]);
const canSend = $derived(draft.trim().length > 0 && !$chat.isLoading);

function readStoredBoolean(key: string, fallback: boolean) {
	try {
		const value = localStorage.getItem(key);
		return value === null ? fallback : value === "true";
	} catch {
		return fallback;
	}
}

function storeBoolean(key: string, value: boolean) {
	try {
		localStorage.setItem(key, String(value));
	} catch {
		// 当前会话仍可继续使用。
	}
}

function readStoredCosmetics(): CosmeticState {
	const defaults = createDefaultCosmetics();
	try {
		const stored = JSON.parse(
			localStorage.getItem(COSMETICS_STORAGE_KEY) ?? "{}",
		) as VampireCosmetics;
		for (const [key, value] of Object.entries(stored) as Array<
			[VampireCosmeticKey, number | undefined]
		>) {
			const definition = VAMPIRE_COSMETIC_PARAMETERS[key];
			if (!definition || typeof value !== "number" || !Number.isFinite(value))
				continue;
			defaults[key] = Math.min(definition.max, Math.max(definition.min, value));
		}
	} catch {
		// 损坏的本地装扮设置回退到模型原始值。
	}
	if (defaults.bangsStyle >= 0.5) defaults.hairpin2 = 0;
	return defaults;
}

function storeCosmetics() {
	try {
		localStorage.setItem(COSMETICS_STORAGE_KEY, JSON.stringify(cosmetics));
	} catch {
		// 当前会话中的装扮仍然有效。
	}
}

function playTone(frequency = 440) {
	if (!soundEnabled || typeof window === "undefined") return;
	const AudioContextClass =
		window.AudioContext ??
		(window as Window & { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AudioContextClass) return;
	const context = new AudioContextClass();
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	const now = context.currentTime;
	oscillator.type = "sine";
	oscillator.frequency.setValueAtTime(frequency, now);
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.025, now + 0.018);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
	oscillator.connect(gain);
	gain.connect(context.destination);
	oscillator.start(now);
	oscillator.stop(now + 0.17);
	oscillator.addEventListener("ended", () => void context.close(), {
		once: true,
	});
}

function toggleEffects() {
	effectsEnabled = !effectsEnabled;
	storeBoolean(EFFECTS_STORAGE_KEY, effectsEnabled);
	stageController?.setEffectsEnabled(effectsEnabled);
	canvasController?.setEffectsEnabled(effectsEnabled);
	playTone(effectsEnabled ? 520 : 280);
}

function toggleSound() {
	soundEnabled = !soundEnabled;
	storeBoolean(SOUND_STORAGE_KEY, soundEnabled);
	if (soundEnabled) playTone(560);
}

async function toggleFullscreen() {
	try {
		if (document.fullscreenElement) await document.exitFullscreen();
		else await workspace.requestFullscreen();
	} catch {
		// 浏览器拒绝全屏时保持当前布局。
	}
}

function applyCamera(
	mode: VampireCameraMode,
	transition: "smooth" | "cut" = "smooth",
) {
	const view = resolveCharacterCamera(mode, chatHidden);
	canvasController?.setCamera(mode, transition);
	stageController?.setView(view.scale, view.offsetX, view.offsetY);
}

function revealVampireIntro() {
	cameraMode = "portrait";
	applyCamera("portrait", "cut");
	stageController?.triggerExpression("stareyes");
	stageController?.triggerAction("mouse", 5_600);
}

function completeVampireIntro(_reason: "ended" | "skipped") {
	introPlaying = false;
	try {
		sessionStorage.setItem(VAMPIRE_INTRO_SESSION_KEY, "complete");
	} catch {
		// 禁用会话存储时仍正常进入舞台。
	}
}

function replayVampireIntro() {
	if (!intro) return;
	returnHintVisible = false;
	returnTouchStartY = null;
	returnTouchHandled = false;
	historyOpen = false;
	settingsOpen = false;
	expressionOpen = false;
	customizeOpen = false;
	introRun += 1;
	introPlaying = true;
}

function updateReturnHint(event: PointerEvent) {
	if (!intro || introPlaying || event.pointerType !== "mouse") {
		returnHintVisible = false;
		return;
	}
	returnHintVisible = event.clientY <= 88;
}

function handleReturnWheel(event: WheelEvent) {
	if (!intro || introPlaying || !returnHintVisible || event.deltaY >= -42) return;
	event.preventDefault();
	replayVampireIntro();
}

function handleReturnTouchStart(event: TouchEvent) {
	if (!intro || introPlaying) return;
	const touch = event.touches[0];
	returnTouchStartY = touch && touch.clientY <= 96 ? touch.clientY : null;
	returnTouchHandled = false;
}

function handleReturnTouchMove(event: TouchEvent) {
	if (!intro || introPlaying || returnTouchStartY === null || returnTouchHandled) return;
	const touch = event.touches[0];
	if (!touch || returnTouchStartY - touch.clientY < 56) return;
	event.preventDefault();
	returnTouchHandled = true;
	replayVampireIntro();
}

function chooseCamera(mode: VampireCameraMode) {
	cameraMode = mode;
	lastManualCamera = true;
	// 手动切镜后5秒内不被情绪联动覆盖
	window.clearTimeout(manualCameraTimer);
	manualCameraTimer = window.setTimeout(() => {
		lastManualCamera = false;
	}, 5000);
	applyCamera(mode);
	playTone(mode === "closeup" ? 590 : mode === "portrait" ? 510 : 430);
}
let manualCameraTimer = 0;

function choosePrompt(prompt: string) {
	draft = prompt;
	showChat();
	void tick().then(() => composer?.focus());
}

let chibiTimer = 0;

function showChibiReaction(expression: ChibiExpression, durationMs = 3_600) {
	chibiExpression = expression;
	chibiPhase = "reaction";
	chibiToken += 1;
	chibiVisible = true;
	window.clearTimeout(chibiTimer);
	chibiTimer = window.setTimeout(() => {
		chibiVisible = false;
	}, durationMs);
}

function holdChibiReaction(expression: ChibiExpression, phase: ChibiPhase) {
	window.clearTimeout(chibiTimer);
	chibiTimer = 0;
	if (!chibiVisible || chibiExpression !== expression) chibiToken += 1;
	chibiExpression = expression;
	chibiPhase = phase;
	chibiVisible = true;
}

function completeChibiReaction(delayMs = 1_600) {
	if (!chibiVisible) return;
	chibiPhase = "complete";
	window.clearTimeout(chibiTimer);
	chibiTimer = window.setTimeout(() => {
		chibiVisible = false;
	}, delayMs);
}

function chibiForExpression(name: string): ChibiExpression {
	if (name === "shy" || name === "sad") return "shy";
	if (
		name === "mad" ||
		name === "circleeyes" ||
		name === "blood-face" ||
		name === "blood-body" ||
		name === "knife"
	) {
		return "startled";
	}
	return "happy";
}

function chibiForEmotion(emotion: string): ChibiExpression {
	if (
		emotion === "anger" ||
		emotion === "angry" ||
		emotion === "mad" ||
		emotion === "confused" ||
		emotion === "surprised"
	) {
		return "startled";
	}
	if (
		emotion === "shy" ||
		emotion === "sad" ||
		emotion === "concerned" ||
		emotion === "anxiety" ||
		emotion === "tired"
	) {
		return "shy";
	}
	return "happy";
}

function showChibiForAssistant(emotion: string) {
	showChibiReaction(
		performanceState.expression
			? chibiForExpression(performanceState.expression)
			: chibiForEmotion(emotion),
	);
}

function hideChat() {
	chatHidden = true;
	historyOpen = false;
	settingsOpen = false;
	customizeOpen = false;
	mobileView = "stage";
	applyCamera(cameraMode);
}

function showChat() {
	chatHidden = false;
	mobileView = "chat";
	applyCamera(cameraMode);
}

/** 情绪 → 自动运镜，仅当用户没有手动切过镜头时生效 */
let lastManualCamera = false;
function onEmotionChange(emotion: string) {
	if (lastManualCamera || chatHidden) return;
	if (emotion === "anger" || emotion === "angry" || emotion === "excited") {
		cameraMode = "closeup";
		applyCamera("closeup", "cut");
	} else if (
		emotion === "happy" ||
		emotion === "affectionate" ||
		emotion === "shy"
	) {
		cameraMode = "portrait";
		applyCamera("portrait");
	}
}

function syncVampireModeFromColors() {
	const colors = [
		cosmetics.outfitWhite,
		cosmetics.hairWhite,
		cosmetics.accessoryWhite,
	];
	if (colors.every((value) => value >= 0.5)) vampireMode = "white";
	else if (colors.every((value) => value < 0.5)) vampireMode = "normal";
	else vampireMode = "custom";
}

function applyCosmetics() {
	if (cosmetics.bangsStyle >= 0.5) cosmetics.hairpin2 = 0;
	stageController?.setCosmetics({ ...cosmetics });
	storeCosmetics();
}

function setCosmetic(key: VampireCosmeticKey, value: number) {
	const definition = VAMPIRE_COSMETIC_PARAMETERS[key];
	cosmetics[key] = Math.min(definition.max, Math.max(definition.min, value));
	if (key === "bangsStyle" && cosmetics.bangsStyle >= 0.5)
		cosmetics.hairpin2 = 0;
	if (key === "hairpin2" && cosmetics.bangsStyle >= 0.5) cosmetics.hairpin2 = 0;
	if (
		key === "outfitWhite" ||
		key === "hairWhite" ||
		key === "accessoryWhite"
	) {
		syncVampireModeFromColors();
	}
	applyCosmetics();
}

function setPonytailStyle(style: PonytailStyle) {
	const next = {
		none: [0, 0, 0],
		left: [1, 1, 0],
		right: [1, 0, 1],
		double: [1, 1, 1],
	}[style];
	[cosmetics.ponytails, cosmetics.ponytailLeft, cosmetics.ponytailRight] = next;
	applyCosmetics();
}

function resetCosmetics() {
	cosmetics = createDefaultCosmetics();
	vampireMode = "normal";
	stageController?.resetCosmetics();
	storeCosmetics();
	playTone(360);
}

function setVampireMode(mode: Exclude<VampireMode, "custom">) {
	vampireMode = mode;
	const white = mode === "white";
	cosmetics.outfitWhite = white ? 1 : 0;
	cosmetics.hairWhite = white ? 1 : 0;
	cosmetics.accessoryWhite = white ? 1 : 0;
	applyCosmetics();
	playTone(white ? 720 : 380);
}

function toggleVampireMode() {
	setVampireMode(vampireMode === "normal" ? "white" : "normal");
}

function triggerExpression(name: VampireExpressionName) {
	stageController?.triggerExpression(name);
	playTone(620);
}

function clearExpression() {
	stageController?.clearExpression();
	playTone(360);
}

function toggleAction(name: VampireActionName) {
	if (performanceState.action === name) stageController?.clearAction();
	else stageController?.triggerAction(name, 5_600);
	playTone(name === "mc" ? 520 : name === "mouse" ? 460 : 360);
}

function toggleModelEffect(name: VampireEffectName) {
	stageController?.toggleEffect(name);
	playTone(330);
}

function resetPerformance() {
	stageController?.clearExpression();
	stageController?.clearAction();
	stageController?.clearEffects();
	playTone(360);
}

function toggleMessageVoice(message: AIChatMessage) {
	if (!message.voice || !voicePlayer) return;
	const active = voiceState.messageId === message.id;
	if (
		active &&
		(voiceState.phase === "queued" ||
			voiceState.phase === "generating" ||
			voiceState.phase === "buffering" ||
			voiceState.phase === "playing")
	) {
		voicePlayer.stop();
		return;
	}
	voicePlayer.unlock();
	void voicePlayer.play({
		messageId: message.id,
		speechJa: message.voice.speechJa,
		emotion: message.voice.emotion,
	});
}

async function sendMessage() {
	const message = draft.trim();
	if (!message || $chat.isLoading) return;
	voicePlayer?.stop();
	voicePlayer?.unlock();
	draft = "";
	lastSubmittedMessage = message;
	mobileView = "chat";
	historyOpen = false;
	settingsOpen = false;
	stageController?.reactToUserMessage(message);
	showChibiReaction("shy");
	playTone(580);
	// 将当前 Live2D 情绪状态附带传给 API，驱动 VTuber 角色台词风格
	const snapshot = stageController?.getSnapshot();
	const emotionContext = snapshot
		? {
				emotion:
					snapshot.emotionIntent?.emotion ??
					snapshot.vad?.dominantEmotion ??
					"neutral",
				valence:
					typeof snapshot.vad?.current?.valence === "number"
						? (snapshot.vad.current.valence + 1) / 2
						: 0.5,
			}
		: null;
	await chat.send(message, emotionContext);
	void tick().then(scrollTranscriptToEnd);
}

async function retryLastMessage() {
	if (!lastSubmittedMessage || $chat.isLoading) return;
	chat.clearError();
	draft = lastSubmittedMessage;
	await tick();
	await sendMessage();
}

function handleComposerKeydown(event: KeyboardEvent) {
	if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
	event.preventDefault();
	void sendMessage();
}

function handleStageClick(event: MouseEvent) {
	if ((event.target as Element | null)?.closest("button")) return;
	canvasController?.burst(event.clientX, event.clientY);
	stageController?.reactToStageClick();
	if (performanceState.action !== "mouse") {
		stageController?.triggerAction("click", 260);
	}
}

function scrollTranscriptToEnd() {
	if (!transcript) return;
	transcript.scrollTo({ top: transcript.scrollHeight, behavior: "smooth" });
}

function startNewSession() {
	voicePlayer?.stop();
	chat.startNewSession();
	historyOpen = false;
	draft = "";
	playTone(500);
	void tick().then(() => composer?.focus());
}

function switchSession(id: string) {
	voicePlayer?.stop();
	chat.switchSession(id);
	historyOpen = false;
	void tick().then(scrollTranscriptToEnd);
}

function formatSessionTime(timestamp: number) {
	return new Intl.DateTimeFormat("zh-CN", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(timestamp);
}

onMount(() => {
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	let introSeen = false;
	try {
		introSeen = sessionStorage.getItem(VAMPIRE_INTRO_SESSION_KEY) === "complete";
	} catch {
		// 禁用会话存储时按首次进入处理。
	}
	introPlaying = Boolean(intro && !reducedMotion && !introSeen);

	effectsEnabled = readStoredBoolean(EFFECTS_STORAGE_KEY, true);
	soundEnabled = readStoredBoolean(SOUND_STORAGE_KEY, false);
	cosmetics = readStoredCosmetics();
	syncVampireModeFromColors();
	const unmountChat = chat.mount();

	stageController = mountSoullinkStage(live2dHost, {
		modelPath,
		cubismCorePath,
		onLoadState: (state) => {
			modelState = state;
		},
		onEmotionChange,
		onPerformanceChange: (state) => {
			performanceState = state;
		},
	});
	stageController.setEffectsEnabled(effectsEnabled);
	stageController.setCosmetics({ ...cosmetics });

	canvasController = mountGothicStageCanvas({
		backdrop: backdropCanvas,
		effects: effectsCanvas,
		container: scene,
		backgroundUrl: background,
		effectsAtlasUrl: effectsAtlas,
		envelopeSequenceAtlasUrl: envelopeSequenceAtlas,
		// onCameraChange 已不需要：所有路径（chooseCamera/hideChat/showChat）都直接调 setView
	});
	canvasController.setEffectsEnabled(effectsEnabled);
	applyCamera("wide", "cut");

	voicePlayer = createVampireVoicePlayer({
		onState: (state) => {
			const startedPlaying =
				state.phase === "playing" && voiceState.phase !== "playing";
			voiceState = { ...state };
			if (
				state.phase === "queued" ||
				state.phase === "generating" ||
				state.phase === "buffering"
			) {
				holdChibiReaction(
					chibiForEmotion(state.emotion),
					state.phase === "buffering" ? "buffering" : "generating",
				);
			} else if (state.phase === "playing") {
				holdChibiReaction(chibiForEmotion(state.emotion), "playing");
			} else if (state.phase === "complete" || state.phase === "error") {
				completeChibiReaction();
			} else if (state.phase === "idle") {
				completeChibiReaction(800);
			}
			if (startedPlaying) {
				const message = chat.snapshot.messages.find(
					(candidate) =>
						candidate.id === state.messageId && candidate.role === "assistant",
				);
				if (message?.content) {
					const intent = stageController?.reactToAssistantVoice(
						state.emotion,
						message.content,
					);
					holdChibiReaction(
						performanceState.expression
							? chibiForExpression(performanceState.expression)
							: chibiForEmotion(intent?.emotion ?? state.emotion),
						"playing",
					);
				}
			}
			void tick().then(scrollTranscriptToEnd);
		},
		onVoiceLevel: (level, peak) => {
			stageController?.setVoiceLevel(level, peak);
		},
		onPlayingChange: (playing) => {
			chat.setSpeaking(playing);
		},
	});

	// 鼠标眼球追踪：用 RAF 从 canvasController 拉归一化坐标传给 Live2D
	let gazeFrame = 0;
	let parallaxX = 0;
	let parallaxY = 0;
	let pointerWasActive = false;
	const shell = workspace.closest<HTMLElement>("[data-xiao-shell]");
	const gazeLoop = () => {
		if (stageController && canvasController) {
			const pointer = canvasController.getPointerNormalized();
			if (pointer) {
				stageController.setMouseGaze(pointer.x, pointer.y, pointer.pressed);
				pointerWasActive = true;
				parallaxX += (pointer.x - parallaxX) * 0.085;
				parallaxY += (pointer.y - parallaxY) * 0.085;
			} else {
				if (pointerWasActive) stageController.setMouseGaze(null, null, false);
				pointerWasActive = false;
				parallaxX += (0 - parallaxX) * 0.085;
				parallaxY += (0 - parallaxY) * 0.085;
			}
			scene.style.setProperty("--stage-mouse-x", parallaxX.toFixed(4));
			scene.style.setProperty("--stage-mouse-y", parallaxY.toFixed(4));
			shell?.style.setProperty("--stage-mouse-x", parallaxX.toFixed(4));
			shell?.style.setProperty("--stage-mouse-y", parallaxY.toFixed(4));
		}
		gazeFrame = window.requestAnimationFrame(gazeLoop);
	};
	gazeFrame = window.requestAnimationFrame(gazeLoop);

	let previousMessageCount = chat.snapshot.messages.length;
	let previousLoading = chat.snapshot.isLoading;
	let lastEnvelopeMessageId = "";
	let lastVoiceMessageId =
		chat.snapshot.messages.at(-1)?.role === "assistant"
			? (chat.snapshot.messages.at(-1)?.id ?? "")
			: "";
	let lastReactedAssistantMessageId =
		chat.snapshot.messages.at(-1)?.role === "assistant"
			? (chat.snapshot.messages.at(-1)?.id ?? "")
			: "";
	const unsubscribe = chat.subscribe((state) => {
		stageController?.setPhase(state.status);
		if (
			state.status === "listening" ||
			state.status === "thinking" ||
			state.status === "streaming"
		) {
			holdChibiReaction("shy", "thinking");
		}
		const latest = state.messages.at(-1);
		const assistantReplySettled =
			state.status !== "listening" &&
			state.status !== "thinking" &&
			state.status !== "streaming";
		if (
			assistantReplySettled &&
			latest?.role === "assistant" &&
			latest.content &&
			latest.id !== lastReactedAssistantMessageId
		) {
			lastReactedAssistantMessageId = latest.id;
			let reactedEmotion = "neutral";
			if (latest.voice) {
				const intent = stageController?.reactToAssistantVoice(
					latest.voice.emotion,
					latest.content,
				);
				reactedEmotion = intent?.emotion ?? latest.voice.emotion;
			} else {
				const intent = stageController?.reactToAssistantMessage(latest.content);
				reactedEmotion = intent?.emotion ?? "neutral";
			}
			showChibiForAssistant(reactedEmotion);
		}
		if (
			previousLoading &&
			!state.isLoading &&
			latest?.role === "assistant" &&
			latest.voice &&
			!latest.streaming &&
			latest.id !== lastVoiceMessageId
		) {
			lastVoiceMessageId = latest.id;
			void voicePlayer?.play({
				messageId: latest.id,
				speechJa: latest.voice.speechJa,
				emotion: latest.voice.emotion,
			});
		}
		if (
			assistantReplySettled &&
			latest?.role === "assistant" &&
			latest.content &&
			latest.id !== lastEnvelopeMessageId
		) {
			lastEnvelopeMessageId = latest.id;
			canvasController?.spawnEnvelopeFlight();
		}
		if (
			state.messages.length !== previousMessageCount ||
			state.status === "streaming"
		) {
			previousMessageCount = state.messages.length;
			void tick().then(scrollTranscriptToEnd);
		}
		previousLoading = state.isLoading;
	});

	const updateClock = () => {
		beijingTime = new Intl.DateTimeFormat("zh-CN", {
			timeZone: "Asia/Shanghai",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hourCycle: "h23",
		}).format(new Date());
	};
	updateClock();
	const clockTimer = window.setInterval(updateClock, 1000);
	const toolbarIntroTimer = window.setTimeout(() => {
		toolbarIntro = false;
	}, 1600);

	const handleFullscreen = () => {
		fullscreenActive = document.fullscreenElement === workspace;
	};
	document.addEventListener("fullscreenchange", handleFullscreen);

	return () => {
		unsubscribe();
		unmountChat();
		voicePlayer?.destroy();
		voicePlayer = null;
		chat.destroy();
		stageController?.destroy();
		stageController = null;
		canvasController?.destroy();
		canvasController = null;
		window.clearInterval(clockTimer);
		window.clearTimeout(toolbarIntroTimer);
		window.clearTimeout(manualCameraTimer);
		window.clearTimeout(chibiTimer);
		if (gazeFrame) window.cancelAnimationFrame(gazeFrame);
		document.removeEventListener("fullscreenchange", handleFullscreen);
	};
});
</script>

<div
	class:effects-off={!effectsEnabled}
	class="xiao-hub"
	onpointermove={updateReturnHint}
	onpointerleave={() => returnHintVisible = false}
	onwheel={handleReturnWheel}
	ontouchstart={handleReturnTouchStart}
	ontouchmove={handleReturnTouchMove}
>
	<section bind:this={workspace} class="xiao-workspace" aria-labelledby="xiao-title" inert={introPlaying}>
		<header class:is-intro={toolbarIntro} class="xiao-workspace__toolbar">
			<a class="xiao-workspace__brand" href="/" data-no-swup aria-label="返回博客首页">
				<span aria-hidden="true">V</span>
				<div>
					<strong id="xiao-title">VICIRA</strong>
					<small>VICIRA · SOULLINK</small>
				</div>
			</a>
			<!-- R3-C: "by kdssss" 打字机 + 字母循环跳跃 -->
			<p class="xiao-workspace__byline" aria-hidden="true">
				<em>by </em>{#each 'kdssss'.split('') as char, i}<span class="xiao-bounce-letter" style="--bi:{i}">{char}</span>{/each}
			</p>

			<div class="xiao-workspace__presence" aria-live="polite">
				<i class:error={$chat.status === "error" || $chat.status === "offline"}></i>
				<strong>{statusLabel}</strong>
				<time>{beijingTime}</time>
			</div>

			<div class="xiao-workspace__tools" aria-label="夜访控制">
				<button type="button" onclick={replayVampireIntro} aria-label="重播吸血鬼片头" title="重播片头">
					<Icon icon="material-symbols:replay-rounded" />
				</button>
				<button type="button" class="xiao-tool--sound" class:is-active={soundEnabled} onclick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? "关闭声音" : "开启声音"} title={soundEnabled ? "关闭声音" : "开启声音"}>
					<Icon icon={soundEnabled ? "material-symbols:volume-up-rounded" : "material-symbols:volume-off-rounded"} />
				</button>
				<button type="button" class:is-active={effectsEnabled} onclick={toggleEffects} aria-pressed={effectsEnabled} aria-label={effectsEnabled ? "关闭舞台特效" : "开启舞台特效"} title={effectsEnabled ? "关闭舞台特效" : "开启舞台特效"}>
					<Icon icon="material-symbols:auto-awesome-outline-rounded" />
				</button>
				<button type="button" class:is-active={vampireMode === "white"} onclick={toggleVampireMode} aria-pressed={vampireMode === "white"} aria-label={vampireMode === "white" ? "恢复黑色形态" : "切换白色形态"} title={vampireMode === "white" ? "恢复黑色形态" : "白色变身"}>
					<Icon icon="material-symbols:invert-colors-rounded" />
				</button>
				<button type="button" onclick={toggleFullscreen} aria-label={fullscreenActive ? "退出全屏" : "进入全屏"} title={fullscreenActive ? "退出全屏" : "进入全屏"}>
					<Icon icon={fullscreenActive ? "material-symbols:fullscreen-exit-rounded" : "material-symbols:fullscreen-rounded"} />
				</button>
				<button type="button" class:is-active={settingsOpen} onclick={() => settingsOpen = !settingsOpen} aria-expanded={settingsOpen} aria-label="打开设置" title="设置">
					<Icon icon="material-symbols:settings-outline-rounded" />
				</button>
			</div>
		</header>

		<nav class="xiao-mobile-switch" aria-label="移动端视图">
			<button type="button" class:is-active={mobileView === "stage"} onclick={() => mobileView = "stage"}>舞台</button>
			<button type="button" class:is-active={mobileView === "chat" && !chatHidden} onclick={showChat}>对话</button>
		</nav>

		<div
			bind:this={scene}
			class:is-chat-hidden={chatHidden}
			class="xiao-workspace__scene"
			data-camera-mode={cameraMode}
		>
			<canvas bind:this={backdropCanvas} class="xiao-scene__backdrop" aria-hidden="true"></canvas>

			<section
				bind:this={stage}
				class:is-mobile-hidden={mobileView !== "stage"}
				class="xiao-stage"
				aria-label="吸血鬼 Live2D 舞台"
				onclick={handleStageClick}
			>
				<div bind:this={live2dHost} class="xiao-stage__live2d" data-live2d-host></div>
				<VampireChibiReaction
					visible={chibiVisible}
					variant={vampireMode === "white" ? "white" : "normal"}
					expression={chibiExpression}
					token={chibiToken}
					phase={chibiPhase}
				/>
				{#if modelState.mode !== "live2d"}
					<div class="xiao-stage__fallback" data-model-fallback>
						<span aria-hidden="true">V</span>
						<strong>{modelState.label}</strong>
						<small>{modelState.detail}</small>
					</div>
				{/if}

				<div class="xiao-stage__credit">
					<span>MODEL</span>
					<strong>吸血鬼少女</strong>
					<small>本地 Cubism · SoulLink 驱动</small>
				</div>

				<div class="xiao-stage__model-state" data-model-mode={modelState.mode}>
					<i></i>
					<div><strong>{modelState.mode === "live2d" ? "LIVE2D" : "LOCAL MODEL"}</strong><small>{modelState.label}</small></div>
				</div>

				<div class="xiao-stage__camera" role="group" aria-label="镜头距离">
					{#each CAMERA_OPTIONS as option (option.id)}
						<button type="button" class:is-active={cameraMode === option.id} onclick={() => chooseCamera(option.id)} aria-pressed={cameraMode === option.id} title={option.label}>
							<Icon icon={option.icon} /><span>{option.label}</span>
						</button>
					{/each}
				</div>

				<button type="button" class="xiao-stage__expression-trigger" class:is-active={expressionOpen} onclick={() => { expressionOpen = !expressionOpen; if (expressionOpen) customizeOpen = false; }} aria-expanded={expressionOpen}>
					<Icon icon="material-symbols:theater-comedy-outline-rounded" />
					<span>表情与动作</span>
				</button>

				<button type="button" class="xiao-stage__customize-trigger" class:is-active={customizeOpen} onclick={() => { customizeOpen = !customizeOpen; if (customizeOpen) expressionOpen = false; }} aria-expanded={customizeOpen} title="装扮替换">
					<Icon icon="material-symbols:palette-outline-rounded" />
					<span>装扮</span>
				</button>

				{#if expressionOpen}
					<div class="xiao-stage__expressions" aria-label="模型表情与动作">
						<header><strong>原生动作库</strong><button type="button" onclick={resetPerformance}>全部复位</button></header>
						<section>
							<strong>表情</strong>
							<div>
							{#each EXPRESSIONS as expression (expression.id)}
								<button type="button" class:is-active={performanceState.expression === expression.id} aria-pressed={performanceState.expression === expression.id} onclick={() => triggerExpression(expression.id)}>{expression.label}</button>
							{/each}
							</div>
						</section>
						<section>
							<strong>动作</strong>
							<div>
								{#each ACTIONS as action (action.id)}
									<button type="button" class:is-active={performanceState.action === action.id} aria-pressed={performanceState.action === action.id} onclick={() => toggleAction(action.id)}>{action.label}</button>
								{/each}
							</div>
						</section>
						<section>
							<strong>血迹</strong>
							<div>
								{#each MODEL_EFFECTS as effect (effect.id)}
									<button type="button" class="special" class:is-active={performanceState.effects.includes(effect.id)} aria-pressed={performanceState.effects.includes(effect.id)} onclick={() => toggleModelEffect(effect.id)}>{effect.label}</button>
								{/each}
							</div>
						</section>
						<small data-performance-scenario>{performanceState.source === "manual" ? "手动演出" : `SoulLink · ${performanceState.scenario}`}</small>
					</div>
				{/if}

				{#if customizeOpen}
					<div class="xiao-stage__customize" aria-label="人物装扮面板">
						<header><strong>装扮替换</strong><div><button type="button" onclick={resetCosmetics}>恢复原装</button><button type="button" onclick={() => customizeOpen = false} aria-label="关闭装扮"><Icon icon="material-symbols:close-rounded" /></button></div></header>
						<section>
							<strong>套装</strong>
							<div class="xiao-customize__segments">
								<button type="button" class:is-active={vampireMode === "normal"} onclick={() => setVampireMode("normal")}>黑色形态</button>
								<button type="button" class:is-active={vampireMode === "white"} onclick={() => setVampireMode("white")}>白色形态</button>
							</div>
						</section>
						<section class="xiao-customize__rows">
							<strong>配色</strong>
							{#each COLOR_CONTROLS as control (control.key)}
								<div class="xiao-customize__row">
									<span>{control.label}</span>
									<div class="xiao-customize__segments">
										<button type="button" class:is-active={cosmetics[control.key] < 0.5} onclick={() => setCosmetic(control.key, 0)}>黑</button>
										<button type="button" class:is-active={cosmetics[control.key] >= 0.5} onclick={() => setCosmetic(control.key, 1)}>白</button>
									</div>
								</div>
							{/each}
						</section>
						<section>
							<strong>刘海与发夹</strong>
							<div class="xiao-customize__segments">
								<button type="button" class:is-active={cosmetics.bangsStyle < 0.5} onclick={() => setCosmetic("bangsStyle", 0)}>M 字刘海</button>
								<button type="button" class:is-active={cosmetics.bangsStyle >= 0.5} onclick={() => setCosmetic("bangsStyle", 1)}>齐刘海</button>
							</div>
							<label class="xiao-customize__slider"><span>{cosmetics.bangsStyle >= 0.5 ? "齐刘海长度" : "M 字刘海长度"}</span><input type="range" min="-1" max="1" step="0.05" value={cosmetics.bangsStyle >= 0.5 ? cosmetics.straightBangsLength : cosmetics.mBangsLength} oninput={(event) => setCosmetic(cosmetics.bangsStyle >= 0.5 ? "straightBangsLength" : "mBangsLength", Number(event.currentTarget.value))} /></label>
							<div class="xiao-customize__checks">
								{#each HAIRPIN_CONTROLS as control (control.key)}
									<label class:is-disabled={control.key === "hairpin2" && cosmetics.bangsStyle >= 0.5} title={control.key === "hairpin2" && cosmetics.bangsStyle >= 0.5 ? "环形发夹仅适配 M 字刘海" : undefined}>
										<input type="checkbox" checked={cosmetics[control.key] >= 0.5} disabled={control.key === "hairpin2" && cosmetics.bangsStyle >= 0.5} onchange={(event) => setCosmetic(control.key, event.currentTarget.checked ? 1 : 0)} />
										<span>{control.label}</span>
									</label>
								{/each}
							</div>
						</section>
						<section>
							<strong>发型结构</strong>
							<div class="xiao-customize__checks">
								<label><input type="checkbox" checked={cosmetics.ahoge >= 0.5} onchange={(event) => setCosmetic("ahoge", event.currentTarget.checked ? 1 : 0)} /><span>呆毛</span></label>
								<label><input type="checkbox" checked={cosmetics.longHair >= 0.5} onchange={(event) => setCosmetic("longHair", event.currentTarget.checked ? 1 : 0)} /><span>长发</span></label>
							</div>
							<div class="xiao-customize__segments xiao-customize__segments--four">
								{#each [{ id: "none", label: "无马尾" }, { id: "left", label: "左单" }, { id: "right", label: "右单" }, { id: "double", label: "双马尾" }] as option (option.id)}
									<button type="button" class:is-active={ponytailStyle === option.id} onclick={() => setPonytailStyle(option.id as PonytailStyle)}>{option.label}</button>
								{/each}
							</div>
							{#each LENGTH_CONTROLS as control (control.key)}
								<label class="xiao-customize__slider"><span>{control.label}长度</span><input type="range" min="-1" max="1" step="0.05" value={cosmetics[control.key]} oninput={(event) => setCosmetic(control.key, Number(event.currentTarget.value))} /></label>
							{/each}
						</section>
					</div>
				{/if}
			</section>

			{#if chatHidden}
				<button type="button" class="xiao-chat__restore" onclick={showChat} aria-label="显示对话框" title="显示对话框">
					<Icon icon="material-symbols:chevron-left-rounded" />
				</button>
			{/if}

			<aside class:is-chat-hidden={chatHidden} class:is-mobile-hidden={mobileView !== "chat"} class="xiao-chat" aria-label="和吸血鬼对话">
				<header class="xiao-chat__header">
					<div class="xiao-chat__identity">
						<span aria-hidden="true">V</span>
						<div><strong>深夜来信</strong><small>{statusLabel}</small></div>
					</div>
					<div class="xiao-chat__header-actions">
						<button type="button" onclick={startNewSession} aria-label="新建对话" title="新建对话"><Icon icon="material-symbols:add-comment-outline-rounded" /></button>
						<button type="button" class:is-active={historyOpen} onclick={() => historyOpen = !historyOpen} aria-expanded={historyOpen} aria-label="历史对话" title="历史对话"><Icon icon="material-symbols:history-rounded" /></button>
						<button type="button" onclick={hideChat} aria-label="隐藏对话框" title="隐藏对话框"><Icon icon="material-symbols:chevron-right-rounded" /></button>
					</div>
				</header>

				{#if historyOpen}
					<div class="xiao-chat__history" aria-label="历史会话">
						<header><strong>往日来信</strong><button type="button" onclick={() => historyOpen = false} aria-label="关闭历史"><Icon icon="material-symbols:close-rounded" /></button></header>
						{#if $chat.sessions.length > 0}
							<ul>
								{#each $chat.sessions as session (session.id)}
									<li class:is-active={session.id === $chat.sessionId}>
										<button type="button" onclick={() => switchSession(session.id)}><strong>{session.title}</strong><small>{formatSessionTime(session.updatedAt)}</small></button>
										<button type="button" onclick={() => chat.deleteSession(session.id)} aria-label={`删除会话 ${session.title}`} title="删除会话"><Icon icon="material-symbols:delete-outline-rounded" /></button>
									</li>
								{/each}
							</ul>
						{:else}
							<p>还没有保存的来信。</p>
						{/if}
					</div>
				{/if}

				{#if settingsOpen}
					<div class="xiao-chat__settings" aria-label="夜访设置">
						<div><span>舞台特效</span><button type="button" class:is-on={effectsEnabled} onclick={toggleEffects} aria-pressed={effectsEnabled}><i></i></button></div>
						<div><span>提示音</span><button type="button" class:is-on={soundEnabled} onclick={toggleSound} aria-pressed={soundEnabled}><i></i></button></div>
						<div><span>模型状态</span><strong>{modelState.label}</strong></div>
					</div>
				{/if}

				<div bind:this={transcript} class="xiao-chat__transcript" aria-live="polite" aria-busy={$chat.isLoading}>
					{#if $chat.messages.length === 0}
						<div class="xiao-chat__welcome">
							<span aria-hidden="true">✦</span>
							<h2>夜色正好。</h2>
							<p>写下第一句话，我会替你收好。</p>
						</div>
					{:else}
						{#each $chat.messages as message (message.id)}
							<article class:user={message.role === "user"} class:assistant={message.role === "assistant"} class:streaming={message.streaming} class="xiao-message">
								<span class="xiao-message__mark" aria-hidden="true">{message.role === "user" ? "✉" : "V"}</span>
								<div>
									<small>{message.role === "user" ? "你的来信" : "夜访回信"}</small>
									<p>{message.content || ($chat.status === "thinking" ? "墨迹正在纸上聚拢……" : "")}</p>
									{#if message.role === "assistant" && message.voice}
										{@const activeVoice = voiceState.messageId === message.id}
										<div class:error={activeVoice && voiceState.phase === "error"} class:playing={activeVoice && voiceState.phase === "playing"} class="xiao-message__voice">
											<button type="button" onclick={() => toggleMessageVoice(message)} aria-label={activeVoice && ["queued", "generating", "buffering", "playing"].includes(voiceState.phase) ? "停止语音" : "播放日语语音"} title={activeVoice && ["queued", "generating", "buffering", "playing"].includes(voiceState.phase) ? "停止" : "播放语音"}>
												<Icon icon={activeVoice && ["queued", "generating", "buffering", "playing"].includes(voiceState.phase) ? "material-symbols:stop-rounded" : "material-symbols:play-arrow-rounded"} />
											</button>
											<div>
												<span lang="ja">{message.voice.speechJa}</span>
												<small title={activeVoice && voiceState.error ? voiceState.error : undefined}>{activeVoice && voiceState.error ? voiceState.error : activeVoice ? VOICE_PHASE_LABELS[voiceState.phase] : "日语语音"}</small>
											</div>
											{#if activeVoice && voiceState.phase !== "idle"}
												<progress max="100" value={voiceState.progress} aria-label={VOICE_PHASE_LABELS[voiceState.phase]}></progress>
												<output>{Math.round(voiceState.progress)}%</output>
											{/if}
										</div>
									{/if}
									{#if message.refs && message.refs.length > 0}
										<ul class="xiao-message__refs" aria-label="参考文章">
											{#each message.refs as reference (reference.path)}
												<li><a href={reference.path}><Icon icon="material-symbols:article-outline-rounded" /><span>{reference.title}</span><Icon icon="material-symbols:arrow-outward-rounded" size="sm" /></a></li>
											{/each}
										</ul>
									{/if}
								</div>
							</article>
						{/each}
					{/if}
				</div>

				<div class="xiao-chat__quick" aria-label="话题">
					{#each QUICK_PROMPTS as prompt (prompt)}
						<button type="button" onclick={() => choosePrompt(prompt)}>{prompt}</button>
					{/each}
				</div>

				<form class="xiao-chat__composer" onsubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
					<button type="button" onclick={() => chat.setListening($chat.status !== "listening")} class:is-active={$chat.status === "listening"} aria-label={$chat.status === "listening" ? "停止聆听" : "开始聆听"} title="聆听"><Icon icon="material-symbols:graphic-eq-rounded" /></button>
					<textarea bind:this={composer} bind:value={draft} onkeydown={handleComposerKeydown} maxlength="1000" rows="1" aria-label="写给吸血鬼" placeholder={$chat.online ? "写下一封短笺……" : "网络状态未知，仍可尝试发送"}></textarea>
					{#if $chat.isLoading}
						<button type="button" class="is-stop" onclick={() => chat.stop()} aria-label="停止生成" title="停止生成"><Icon icon="material-symbols:stop-rounded" /></button>
					{:else}
						<button type="submit" class="is-send" disabled={!canSend} aria-label="封缄并发送" title="发送"><Icon icon="material-symbols:mail-outline-rounded" /></button>
					{/if}
				</form>

				{#if $chat.lastError}
					<div class="xiao-chat__error" role="alert">
						<Icon icon="material-symbols:error-outline-rounded" />
						<span>{$chat.lastError.message}</span>
						{#if $chat.lastError.recoverable && lastSubmittedMessage}
							<button type="button" onclick={() => void retryLastMessage()} aria-label="重试上一条消息" title="重试"><Icon icon="material-symbols:refresh-rounded" /></button>
						{/if}
						<button type="button" onclick={() => chat.clearError()} aria-label="关闭错误提示" title="关闭"><Icon icon="material-symbols:close-rounded" /></button>
					</div>
				{/if}
			</aside>

			<canvas bind:this={effectsCanvas} class="xiao-scene__effects" aria-hidden="true"></canvas>
		</div>
	</section>
	{#if intro && !introPlaying}
		<button
			class:is-visible={returnHintVisible}
			class="xiao-return-intro"
			type="button"
			onclick={replayVampireIntro}
			aria-label="重返 VICIRA 封印"
			title="向上滑动重返封印"
		>
			<Icon icon="material-symbols:keyboard-arrow-up-rounded" />
			<span>向上滑动重返封印</span>
		</button>
	{/if}
	{#if intro && introPlaying}
		{#key introRun}
			<VampireChainIntro
				config={intro}
				onReveal={revealVampireIntro}
				onComplete={completeVampireIntro}
			/>
		{/key}
	{/if}
</div>
