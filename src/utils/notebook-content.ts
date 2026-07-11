import { buildGptImageUrl } from "@/utils/activity-content";

export interface NotebookEntryLike {
	id: string;
	notebook: string;
	title: string;
	date: string;
	content: string;
	cover?: string;
	updatedAt?: number;
}

export interface NotebookGroupMeta {
	name: string;
	eyebrow: string;
	intro: string;
	listDescription: string;
	heroTitle: string;
	heroDescription: string;
	coverImage: string;
	coverAlt: string;
	tags: string[];
}

export interface NotebookEntryMeta {
	image: string;
	imageAlt: string;
	summary: string;
	insight: string;
	labels: string[];
}

const NOTEBOOK_GROUPS: Record<string, Omit<NotebookGroupMeta, "name">> = {
	"治愈日常番": {
		eyebrow: "Healing Notes",
		intro: "把让人松弛下来的日常番单独收好，适合情绪嘈杂的时候慢慢看。",
		listDescription: "更偏轻松、温柔和陪伴感的作品，适合在状态紧的时候给自己一点缓冲。",
		heroTitle: "治愈日常番",
		heroDescription: "记录那些能把情绪慢慢放平的番剧，重点不是情节起伏，而是舒服、耐看和陪伴感。",
		coverImage: "/assets/images/notebook-bg/bg-1.webp",
		coverAlt: "治愈系日常番头图",
		tags: ["轻松", "陪伴", "日常"],
	},
	"热血战斗番": {
		eyebrow: "Battle Notes",
		intro: "偏高压、高燃和情绪张力强的作品，适合专门记录名场面和角色爆发点。",
		listDescription: "更关注压迫感、战损感和角色意志力，看的时候很容易被情绪带着往前走。",
		heroTitle: "热血战斗番",
		heroDescription: "把最有压迫感和爆发力的战斗番收在一起，重点记下剧情推进、角色成长和情绪爆点。",
		coverImage: "/assets/images/notebook-bg/bg-2.webp",
		coverAlt: "热血战斗番头图",
		tags: ["高燃", "冲突", "成长"],
	},
	"异世界番": {
		eyebrow: "Fantasy Notes",
		intro: "更看重世界观、旅途感和氛围沉浸，不是单纯爽点，而是完整的异世界体验。",
		listDescription: "这组更偏旅途、奇幻和慢节奏沉浸，适合记录设定、气质和人物关系。",
		heroTitle: "异世界番",
		heroDescription: "收录那些世界观完整、旅途感很强的异世界作品，更在意氛围、角色成长和旅程余味。",
		coverImage: "/assets/images/notebook-bg/bg-3.webp",
		coverAlt: "异世界番头图",
		tags: ["奇幻", "旅途", "世界观"],
	},
	"校园恋爱番": {
		eyebrow: "Romance Notes",
		intro: "主要记录那种对白好、拉扯感强、会让人忍不住反复回想桥段的校园恋爱作品。",
		listDescription: "更偏对白、拉扯和人物关系推进，看的不是表白本身，而是心动过程。",
		heroTitle: "校园恋爱番",
		heroDescription: "把校园恋爱里最会写对白、最会制造心动和拉扯感的作品单独归档，方便回味。",
		coverImage: "/assets/images/notebook-bg/bg-4.webp",
		coverAlt: "校园恋爱番头图",
		tags: ["心动", "对白", "拉扯"],
	},
	"推理悬疑番": {
		eyebrow: "Mystery Notes",
		intro: "这类作品更适合拆伏笔和记情绪节奏，通常后劲很强，适合做成单独观察笔记。",
		listDescription: "更关注伏笔、回收和氛围控制，属于看完之后会想回头复盘的类型。",
		heroTitle: "推理悬疑番",
		heroDescription: "集中记录那些伏笔扎实、反转有效、氛围控制很稳的悬疑作品，方便回头复盘。",
		coverImage: "/assets/images/notebook-bg/bg-5.webp",
		coverAlt: "推理悬疑番头图",
		tags: ["反转", "暗线", "复盘"],
	},
	"运动番": {
		eyebrow: "Sports Notes",
		intro: "主要收热血、团队和成长感都很强的运动番，适合在低状态时回来给自己打气。",
		listDescription: "更偏团队、逆风和一点点变强的过程，看的不是结果，而是把人重新点燃的那股劲。",
		heroTitle: "运动番",
		heroDescription: "把最能点燃状态的运动番单独归档，重点记住团队感、逆风成长和那种被重新鼓起来的劲头。",
		coverImage: "/assets/images/notebook-bg/bg-6.webp",
		coverAlt: "运动番头图",
		tags: ["团队", "逆风", "热血"],
	},
};

const NOTEBOOK_ENTRY_META: Record<
	string,
	{ prompt: string; imageAlt: string; summary: string; insight: string; labels: string[] }
> = {
	"治愈日常番::《擅长捉弄的高木同学》": {
		prompt:
			"anime-inspired but original illustration, bright classroom by the window, teenage girl teasing boy with a gentle smile, warm sunlight, soft pastel palette, slice of life atmosphere",
		imageAlt: "温柔校园日常场景",
		summary: "这部最打动人的地方不是剧情密度，而是那种轻轻松松就能把情绪放下来的陪伴感。",
		insight: "高木和西片的互动不会刻意用力，但会让人一直保持嘴角上扬。",
		labels: ["轻松互动", "校园日常", "治愈感"],
	},
	"治愈日常番::《关于前辈很烦人的事》": {
		prompt:
			"anime-inspired office romance illustration, cute workplace scene, petite woman and dependable senior in a modern office, soft daylight, warm and playful mood",
		imageAlt: "轻松职场恋爱氛围图",
		summary: "它的节奏很轻，但角色关系非常稳，属于会让人边看边觉得心情变好的类型。",
		insight: "短篇幅里还能把多对角色关系写得这么自然，是这部很舒服的地方。",
		labels: ["职场恋爱", "可爱画风", "轻喜剧"],
	},
	"热血战斗番::《咒术回战》第二季": {
		prompt:
			"anime-inspired dark action illustration, intense sorcerer battle in ruined city, dramatic cyan and purple lighting, dynamic composition, emotional tension",
		imageAlt: "高压战斗场景",
		summary: "这一季强在情绪强度和制作完成度同时在线，角色过去与现在都被推到了很高的位置。",
		insight: "不是只有打斗燃点，人物关系撕开之后的后劲也很重。",
		labels: ["战损感", "高压情绪", "制作爆发"],
	},
	"热血战斗番::《进击的巨人》最终季": {
		prompt:
			"anime-inspired epic war illustration, lone figure facing massive ruined walls and smoky battlefield, dramatic sky, heavy atmosphere, cinematic scale",
		imageAlt: "末世战争氛围图",
		summary: "这部最强的地方是会逼着人去想立场、自由和代价，不只是单纯追求爽感。",
		insight: "结局的争议本身，也是它把问题推得足够深的证明。",
		labels: ["宿命感", "战争叙事", "高压思考"],
	},
	"异世界番::《无职转生》第二季": {
		prompt:
			"anime-inspired fantasy illustration, young mage traveling through medieval town and open field, detailed worldbuilding, warm afternoon light, immersive atmosphere",
		imageAlt: "异世界旅途氛围图",
		summary: "它的优势是世界观和人物成长都铺得很细，所以慢节奏也不会让人觉得空。",
		insight: "很多异世界只负责给爽点，但这部更像是在认真写一个人的成长阶段。",
		labels: ["成长线", "世界观", "细腻叙事"],
	},
	"异世界番::《葬送的芙莉莲》": {
		prompt:
			"anime-inspired fantasy illustration, serene elf mage walking through flower meadow with distant mountains, gentle breeze, melancholic and healing atmosphere",
		imageAlt: "芙莉莲式奇幻旅途感",
		summary: "它的情绪不是立刻冲上来，而是会在安静的旅途中一点点落到心里。",
		insight: "慢节奏不是缺点，反而让时间和记忆这件事变得特别有分量。",
		labels: ["慢节奏", "旅途感", "余味"],
	},
	"校园恋爱番::《辉夜大小姐想让我告白》": {
		prompt:
			"anime-inspired romantic comedy illustration, elegant student council room, confident girl and serious boy in a playful mind game atmosphere, pink and gold accents",
		imageAlt: "学生会恋爱头脑战氛围图",
		summary: "它最厉害的地方是把恋爱拉扯写得像一场有节奏感的攻防战，又甜又好笑。",
		insight: "高密度笑点之外，真正留下来的还是角色慢慢靠近的过程。",
		labels: ["头脑战", "高密度笑点", "心动拉扯"],
	},
	"校园恋爱番::《青春猪头少年不会梦到兔女郎学姐》": {
		prompt:
			"anime-inspired school romance illustration, twilight school corridor, calm boy and elegant girl, subtle supernatural mood, soft cinematic light",
		imageAlt: "青春期症候群氛围图",
		summary: "表面是奇异设定，真正抓人的还是人物对白和关系推进时的成熟感。",
		insight: "咲太的表达方式很直接，所以情绪线反而显得特别干净利落。",
		labels: ["对白强", "青春期情绪", "角色关系"],
	},
	"推理悬疑番::《只有我不存在的城市》": {
		prompt:
			"anime-inspired suspense illustration, snowy town street at dusk, lone figure running through winter alley, nostalgic yet tense atmosphere, cinematic framing",
		imageAlt: "冬日悬疑追查场景",
		summary: "这部的推进特别紧，时间回溯只是手段，真正抓人的是想把某件事拼命改回来的焦灼感。",
		insight: "它把悬疑感和情感救赎揉在了一起，所以看完不只是紧张，还会很沉。",
		labels: ["时空回溯", "紧凑", "情绪后劲"],
	},
	"推理悬疑番::《奇巧计程车》": {
		prompt:
			"anime-inspired urban mystery illustration, late night city street with taxi under neon lights, layered storytelling mood, clean noir composition",
		imageAlt: "都市悬疑出租车夜景",
		summary: "前面像在随手聊天，后面才会发现每一句都在给后续埋钩子，回收时非常过瘾。",
		insight: "它最厉害的是冷静，不急着炫技，但每条线都能稳稳扣上。",
		labels: ["多线叙事", "伏笔回收", "都市黑色感"],
	},
	"运动番::《排球少年!!》第四季": {
		prompt:
			"anime-inspired sports illustration, intense indoor volleyball match, orange black uniform team jumping for spike, bright arena lights, strong momentum",
		imageAlt: "热血排球比赛场景",
		summary: "最燃的不是赢球瞬间，而是每个人都很认真地朝前走，团队感特别扎实。",
		insight: "乌野最打动人的地方，一直都是每个人都在把自己的短板慢慢补上。",
		labels: ["团队成长", "比赛张力", "高燃"],
	},
	"运动番::《蓝色监狱》": {
		prompt:
			"anime-inspired sports illustration, futuristic football training facility, lone striker under neon blue lighting, aggressive competitive atmosphere, dynamic perspective",
		imageAlt: "高压足球训练氛围图",
		summary: "它的设定很锋利，直接把竞争感和个人欲望推到前台，所以看起来会格外上头。",
		insight: "中二感其实是它的风格优势，刚好把那种极端胜负欲放大出来了。",
		labels: ["胜负欲", "高压竞争", "风格化"],
	},
};

function getEntryKey(entry: Pick<NotebookEntryLike, "notebook" | "title">): string {
	return `${entry.notebook}::${entry.title}`;
}

function createFallbackSummary(content: string): string {
	const text = (content || "").replace(/\s+/g, " ").trim();
	if (!text) return "这条笔记还在整理中。";
	return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function createFallbackInsight(content: string): string {
	const summary = createFallbackSummary(content);
	return summary === "这条笔记还在整理中。"
		? "先留一个位置，后面再把想法补完整。"
		: summary;
}

export function getNotebookGroupMeta(name: string): NotebookGroupMeta {
	const meta = NOTEBOOK_GROUPS[name];
	if (meta) {
		return {
			name,
			...meta,
		};
	}

	return {
		name,
		eyebrow: "Notebook",
		intro: "把最近整理的笔记集中收在这里，方便按主题回看。",
		listDescription: "这一组内容还在持续补充，先把核心主题和最近留下来的想法放在一起。",
		heroTitle: name,
		heroDescription: "按主题整理的笔记内容，后续会继续补充图片、说明和更完整的观感记录。",
		coverImage: "/assets/images/notebook-bg/bg-7.webp",
		coverAlt: `${name}头图`,
		tags: ["记录", "整理", "回看"],
	};
}

export function getNotebookEntryMeta(entry: NotebookEntryLike): NotebookEntryMeta {
	const matched = NOTEBOOK_ENTRY_META[getEntryKey(entry)];
	if (matched) {
		return {
			image: buildGptImageUrl(matched.prompt, "landscape_16_9"),
			imageAlt: matched.imageAlt,
			summary: matched.summary,
			insight: matched.insight,
			labels: matched.labels,
		};
	}

	return {
		image: buildGptImageUrl(
			`clean editorial illustration, anime-inspired but original, ${entry.notebook}, ${entry.title}, soft cinematic light, detailed composition`,
			"landscape_16_9",
		),
		imageAlt: entry.title,
		summary: createFallbackSummary(entry.content),
		insight: createFallbackInsight(entry.content),
		labels: [entry.notebook, "记录"],
	};
}

