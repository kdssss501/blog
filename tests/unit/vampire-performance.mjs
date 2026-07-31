import assert from "node:assert/strict";
import {
	buildVampirePerformancePlan,
	VAMPIRE_ACTION_CONTROLS,
	VAMPIRE_ACTION_NEUTRAL_PARAMETERS,
	VAMPIRE_ACTION_PARAMETERS,
	VAMPIRE_COSMETIC_PARAMETERS,
	VAMPIRE_EFFECT_CONTROLS,
	VAMPIRE_EFFECT_NEUTRAL_PARAMETERS,
	VAMPIRE_EFFECT_PARAMETERS,
	VAMPIRE_EXPRESSION_CONTROLS,
	VAMPIRE_VBRIDGER_NEUTRAL_PARAMETERS,
	VAMPIRE_VBRIDGER_PARAMETERS,
} from "../../src/features/xiao/model/vampire-performance.ts";

const baseIntent = (emotion = "neutral") => ({
	emotion,
	variant: "baseline",
	intensity: 0.5,
	contextTags: ["unit-test"],
	sourceMessage: "",
});

const assistantPlan = (message, emotion = "neutral") =>
	buildVampirePerformancePlan(baseIntent(emotion), message, "assistant");
const userPlan = (message, emotion = "neutral") =>
	buildVampirePerformancePlan(baseIntent(emotion), message, "user");

assert.deepEqual(
	VAMPIRE_EXPRESSION_CONTROLS.map(({ id, label, safe }) => ({
		id,
		label,
		safe,
	})),
	[
		{ id: "shy", label: "脸红", safe: true },
		{ id: "sad", label: "哭哭", safe: true },
		{ id: "mad", label: "黑脸生气", safe: true },
		{ id: "hearteyes", label: "爱心眼", safe: true },
		{ id: "stareyes", label: "星星眼", safe: true },
		{ id: "circleeyes", label: "蚊香眼", safe: true },
	],
	"all six native expression controls must remain available",
);

const scenarios = [
	{
		message: "这是危险操作，请立即停止。",
		scenario: "warning",
		emotion: "anger",
		expression: "mad",
		variant: "guarded_warning",
	},
	{
		message: "辛苦了，慢慢来，我会陪着你。",
		scenario: "comfort",
		emotion: "concerned",
		expression: "sad",
		variant: "comfort",
	},
	{
		message: "好消息，问题已经修好，任务完成了。",
		scenario: "celebration",
		emotion: "happy",
		expression: "stareyes",
		variant: "celebrating",
	},
	{
		message: "谢谢你，我会记住这封信。",
		scenario: "affection",
		emotion: "affectionate",
		expression: "hearteyes",
		variant: "warm_reply",
	},
	{
		message: "结果有点奇怪，需要再确认。",
		scenario: "uncertain",
		emotion: "confused",
		expression: "circleeyes",
		variant: "checking",
	},
	{
		message: "让我看看这段代码，我来分析。",
		scenario: "curious_work",
		emotion: "curious",
		expression: "stareyes",
		variant: "focused",
	},
];

for (const expected of scenarios) {
	const performance = assistantPlan(expected.message);
	assert.equal(performance.cue.scenario, expected.scenario);
	assert.equal(performance.cue.intent.emotion, expected.emotion);
	assert.equal(performance.cue.intent.variant, expected.variant);
	assert.equal(performance.cue.expression, expected.expression);
	assert.equal(performance.cue.source, "assistant");
	assert.equal(performance.cue.intent.sourceMessage, expected.message);
	assert.deepEqual(
		performance.plan.intent,
		performance.cue.intent,
		"SoulLink and the visible cue must share the resolved intent",
	);
	assert.ok(
		performance.plan.vadTarget,
		`${expected.scenario} needs a VAD target`,
	);
}

const actionCases = [
	{ message: "请打开麦克风朗读这封信。", action: "mc" },
	{ message: "请用数位板画画。", action: "mouse" },
	{ message: "拿出美工刀保护自己。", action: "knife" },
	{ message: "请点击确认按钮。", action: "click" },
];

for (const { message, action } of actionCases) {
	const { cue } = userPlan(message);
	assert.equal(cue.action, action, `${message} should trigger ${action}`);
	assert.equal(cue.durationMs, action === "click" ? 260 : 5_600);
}

assert.deepEqual(
	VAMPIRE_ACTION_CONTROLS.map(({ id }) => id),
	["mc", "mouse", "knife", "click"],
);
assert.deepEqual(VAMPIRE_ACTION_PARAMETERS, {
	mc: { PARAMhands_1: 1, PARAMhands_2: 0, PARAMhands_3: 0 },
	knife: { PARAMhands_1: 0, PARAMhands_2: 1, PARAMhands_3: 0 },
	mouse: { PARAMhands_1: 0, PARAMhands_2: 0, PARAMhands_3: 1 },
	click: { Paramclick: 1 },
});
assert.deepEqual(VAMPIRE_ACTION_NEUTRAL_PARAMETERS, {
	PARAMhands_1: 0,
	PARAMhands_2: 0,
	PARAMhands_3: 0,
	Paramclick: 0,
});
assert.equal(userPlan("普通问候").cue.action, null);
assert.equal(userPlan("普通问候").cue.durationMs, 4_600);

const effectCases = [
	{ message: "她脸上有血。", effects: ["blood-face"] },
	{ message: "她胸口有血。", effects: ["blood-body"] },
	{ message: "出现血迹。", effects: ["blood-face", "blood-body"] },
	{ message: "脖子上有咬伤。", effects: ["blood-face"] },
	{ message: "战斗后受伤。", effects: ["blood-body"] },
];

for (const { message, effects } of effectCases) {
	assert.deepEqual(userPlan(message).cue.effects, effects);
}

assert.deepEqual(
	VAMPIRE_EFFECT_CONTROLS.map(({ id }) => id),
	["blood-face", "blood-body"],
);
assert.deepEqual(VAMPIRE_EFFECT_PARAMETERS, {
	"blood-face": { PARAMBLOOD2: 1 },
	"blood-body": { PARAMblood1: 1 },
});
assert.deepEqual(VAMPIRE_EFFECT_NEUTRAL_PARAMETERS, {
	PARAMBLOOD2: 0,
	PARAMblood1: 0,
});

const celebration = assistantPlan("太好了，已经解决了。");
assert.equal(celebration.plan.provider, "vampire-native-state-machine");
assert.equal(celebration.plan.replyDraft, "太好了，已经解决了。");
assert.equal(celebration.plan.actionPlan.length, 1);
assert.deepEqual(celebration.plan.actionPlan[0], {
	time: 0,
	duration: 1.1,
	label: "vampire-happy",
	intensity: 0.78,
	facs: { eyeSmile: 0.62, headZ: 0.12, bodyY: 0.08 },
});
assert.equal(celebration.plan.parameterPlan.length, 2);
assert.deepEqual(celebration.plan.parameterPlan[0], {
	time: 0,
	duration: 0.24,
	label: "vampire-happy-accent",
	parameters: {
		PARAM_BODY_POSITION_Z: 5.2,
		PARAM_JAW_OPEN: 0.28,
		PARAMMOUSE_X: 0.12,
	},
});
assert.equal(
	celebration.plan.parameterPlan.at(-1).parameters.PARAM_BODY_POSITION_Z,
	1.04,
);

const longReply = "星".repeat(300);
assert.equal(assistantPlan(longReply).plan.replyDraft.length, 240);
assert.equal(userPlan("谢谢你", "shy").plan.replyDraft, "");

const expectedCosmetics = {
	outfitWhite: ["PARAMoutfit1_2", 0, 1, 0],
	hairWhite: ["PARAMhariWB", 0, 1, 0],
	accessoryWhite: ["PARAMhariWB2", 0, 1, 0],
	ahoge: ["PARAMahoke", 0, 1, 1],
	bangsStyle: ["PARAMhari_1", 0, 1, 0],
	straightBangsLength: ["PARAMhari_6", -1, 1, 0],
	mBangsLength: ["PARAMhari_7", -1, 1, 0],
	sideHairLength: ["PARAMhari_8", -1, 1, 0],
	ponytailLeft: ["PARAMhari_2_1", 0, 1, 1],
	ponytailRight: ["PARAMhari_2_2", 0, 1, 1],
	ponytails: ["PARAMhari_2", 0, 1, 1],
	ponytailLength: ["PARAMhari_5", -1, 1, 0],
	longHair: ["PARAMhari_3", 0, 1, 0],
	longHairLength: ["PARAMhari_4", -1, 1, 0],
	hairpin1: ["PARAMhairpin_1", 0, 1, 0],
	hairpin2: ["PARAMhairpin_2", 0, 1, 0],
	hairpin3: ["PARAMhairpin_3", 0, 1, 0],
};

assert.deepEqual(
	Object.keys(VAMPIRE_COSMETIC_PARAMETERS),
	Object.keys(expectedCosmetics),
);
const cosmeticIds = new Set();
for (const [key, [id, min, max, defaultValue]] of Object.entries(
	expectedCosmetics,
)) {
	const definition = VAMPIRE_COSMETIC_PARAMETERS[key];
	assert.ok(definition, `missing cosmetic ${key}`);
	assert.equal(definition.id, id);
	assert.equal(definition.min, min);
	assert.equal(definition.max, max);
	assert.equal(definition.default, defaultValue);
	assert.ok(
		defaultValue >= min && defaultValue <= max,
		`${key} default is out of range`,
	);
	assert.equal(cosmeticIds.has(id), false, `duplicate Live2D parameter ${id}`);
	cosmeticIds.add(id);
}

const binaryCosmetics = [
	"outfitWhite",
	"hairWhite",
	"accessoryWhite",
	"ahoge",
	"bangsStyle",
	"ponytailLeft",
	"ponytailRight",
	"ponytails",
	"longHair",
	"hairpin1",
	"hairpin2",
	"hairpin3",
];
for (const key of binaryCosmetics) {
	const { min, max } = VAMPIRE_COSMETIC_PARAMETERS[key];
	assert.deepEqual([min, max], [0, 1], `${key} must remain a binary control`);
}

const ponytailStates = {
	double: { ponytails: 1, ponytailLeft: 1, ponytailRight: 1 },
	left: { ponytails: 1, ponytailLeft: 1, ponytailRight: 0 },
	right: { ponytails: 1, ponytailLeft: 0, ponytailRight: 1 },
	none: { ponytails: 0, ponytailLeft: 0, ponytailRight: 0 },
};
for (const [name, state] of Object.entries(ponytailStates)) {
	for (const [key, value] of Object.entries(state)) {
		const definition = VAMPIRE_COSMETIC_PARAMETERS[key];
		assert.ok(
			value >= definition.min && value <= definition.max,
			`${name}.${key} is unsupported`,
		);
	}
	assert.equal(
		state.ponytails,
		Number(state.ponytailLeft === 1 || state.ponytailRight === 1),
		`${name} must keep the aggregate ponytail switch coherent`,
	);
}

assert.equal(
	VAMPIRE_COSMETIC_PARAMETERS.bangsStyle.default,
	0,
	"the default M bangs must remain compatible with the ring hairpin",
);
assert.equal(
	VAMPIRE_COSMETIC_PARAMETERS.hairpin2.default,
	0,
	"the M-bangs-only ring hairpin must be opt-in",
);
for (const key of ["hairpin1", "hairpin2", "hairpin3"]) {
	assert.equal(VAMPIRE_COSMETIC_PARAMETERS[key].default, 0);
}

const expectedVBridger = {
	forwardLean: ["PARAM_BODY_POSITION_Z", 0, 10, 0],
	mouthFunnel: ["PARAMMOUSEFUNNEL", 0, 1, 0],
	mouthShrug: ["PARAM_MOUSE_SHRUG", 0, 1, 0],
	jawOpen: ["PARAM_JAW_OPEN", 0, 1, 0],
	cheekPuff: ["PARAM_CHEEK_PUFF", 0, 1, 0],
	mouthSkew: ["PARAMMOUSE_X", -1, 1, 0],
	lipPress: ["PARAMMOUSE_PRESS_LIP_OPEN", -1, 1, 0],
	mouthPucker: ["PARAMMOUSE_PUNKER", -1, 1, 0],
};
assert.deepEqual(
	Object.keys(VAMPIRE_VBRIDGER_PARAMETERS),
	Object.keys(expectedVBridger),
);
for (const [key, [id, min, max, neutral]] of Object.entries(expectedVBridger)) {
	assert.deepEqual(VAMPIRE_VBRIDGER_PARAMETERS[key], {
		id,
		min,
		max,
		neutral,
	});
	assert.equal(VAMPIRE_VBRIDGER_NEUTRAL_PARAMETERS[id], neutral);
}

const parameterGestureCases = [
	{
		message: "谢谢你，晚安。",
		parameter: "PARAM_BODY_POSITION_Z",
		minimum: 7,
	},
	{
		message: "我有点困惑，需要再确认。",
		parameter: "PARAM_MOUSE_SHRUG",
		minimum: 0.7,
	},
	{
		message: "危险，立即停止。",
		parameter: "PARAMMOUSE_PRESS_LIP_OPEN",
		minimum: 0.7,
	},
	{
		message: "鼓起脸颊表示赌气。",
		parameter: "PARAM_CHEEK_PUFF",
		minimum: 0.8,
	},
	{
		message: "嘟嘴亲吻一下。",
		parameter: "PARAMMOUSE_PUNKER",
		minimum: 0.8,
	},
	{
		message: "露出一个狡黠的坏笑。",
		parameter: "PARAMMOUSE_X",
		minimum: 0.7,
	},
];
for (const { message, parameter, minimum } of parameterGestureCases) {
	const plan = assistantPlan(message).plan.parameterPlan;
	assert.ok(plan.length > 0, `${message} needs a parameter plan`);
	assert.ok(
		plan[0].parameters[parameter] >= minimum,
		`${message} did not drive ${parameter}`,
	);
	assert.deepEqual(
		plan.at(-1).parameters,
		{
			...VAMPIRE_VBRIDGER_NEUTRAL_PARAMETERS,
			PARAM_BODY_POSITION_Z: Math.min(
				1.2,
				plan[0].parameters.PARAM_BODY_POSITION_Z * 0.2,
			),
		},
		`${message} did not release to the neutral face`,
	);
}

assert.ok(
	assistantPlan("咧嘴笑起来。").plan.parameterPlan[0].parameters
		.PARAMMOUSE_PUNKER < -0.6,
	"negative MouthPucker must remain reachable",
);

const chewPlan = assistantPlan("一起吃一口蛋糕，慢慢咀嚼。").plan.parameterPlan;
assert.equal(chewPlan.length, 5);
assert.deepEqual(
	chewPlan.slice(0, 4).map((beat) => beat.parameters.PARAM_JAW_OPEN),
	[0.64, 0.08, 0.52, 0.06],
);
assert.deepEqual(
	chewPlan.at(-1).parameters,
	VAMPIRE_VBRIDGER_NEUTRAL_PARAMETERS,
);

console.log("Vampire performance state-machine checks passed.");
