import type { ActivityRecord } from "@/utils/activity-content";
import { getLocalActivityGalleryUrl } from "@/utils/activity-gallery";

export const LOCAL_ACTIVITY_IMAGE_PREFIX = "/gallery/gpt-img2-2026/";
export const ACTIVITY_PRESET_VERSION = "modern-v2";
const GALLERY_NOTE_06_UPDATED_AT = new Date("2026-07-11T19:04:00+08:00").getTime();

interface ActivityBodyConfig {
	heading: string;
	leadImageUrl: string;
	leadImageAlt: string;
	leadImageCaption: string;
	intro: string;
	sectionTitle: string;
	sectionParagraph: string;
	quote: string;
	bullets: string[];
	codeLang: string;
	code: string;
	galleryTitle: string;
	galleryImageUrl: string;
	galleryImageAlt: string;
	galleryImageCaption: string;
	ordered: string[];
	closing: string;
}

function createActivityBody(config: ActivityBodyConfig): string {
	return [
		`## ${config.heading}`,
		`![${config.leadImageAlt}](${config.leadImageUrl} "${config.leadImageCaption}")`,
		config.intro,
		`### ${config.sectionTitle}`,
		config.sectionParagraph,
		...config.bullets.map((item) => `- ${item}`),
		`> ${config.quote}`,
		"---",
		"### 内容片段",
		`~~~${config.codeLang}`.replace("~~~", "```"),
		config.code,
		"```",
		`#### ${config.galleryTitle}`,
		`![${config.galleryImageAlt}](${config.galleryImageUrl} "${config.galleryImageCaption}")`,
		...config.ordered.map((item, index) => `${index + 1}. ${item}`),
		config.closing,
	].join("\n\n");
}

export function getDefaultActivities(now = Date.now()): ActivityRecord[] {
	return [
		{
			id: "activity-001",
			slug: "gallery-note-01",
			title: "图集手记 01｜把节奏放轻一点",
			excerpt: "第一组动态改成了本地图册图文，先把今天的状态慢慢放轻。",
			content: "图集手记 01，把节奏放轻一点。",
			body: createActivityBody(
				{
					heading: "图集手记 01｜把节奏放轻一点",
					leadImageUrl: getLocalActivityGalleryUrl("1.webp"),
					leadImageAlt: "图集 01 对应配图",
					leadImageCaption: "用第一张图当作页面开场，让阅读先慢下来。",
					intro: "这次不再把动态当成一段普通文本，而是把它重构成更接近文章的阅读体验：有呼吸感的段落、明确的标题层级，以及更安静的留白。",
					sectionTitle: "这次先改了什么",
					sectionParagraph: "先把图片来源、富文本渲染、目录生成和异步加载统一起来，再去谈视觉和交互，页面质感会稳定很多。",
					quote: "当一条动态拥有标题、图片、段落和留白之后，它才真正开始像一篇内容，而不是一句状态。",
					bullets: [
						"统一首图、正文图与图廊的来源，避免详情页图片跳路径。",
						"把正文从纯 HTML 拼接升级为结构化富文本渲染。",
						"让目录和滚动状态形成同步，阅读过程更明确。",
					],
					codeLang: "ts",
					code: 'const activityView = {\n  mode: "modern",\n  lazyImage: true,\n  reveal: "intersection-observer",\n  toc: "follow-scroll",\n};',
					galleryTitle: "把开场感放进第二张图",
					galleryImageUrl: getLocalActivityGalleryUrl("2.webp"),
					galleryImageAlt: "图集 02 补充配图",
					galleryImageCaption: "第二张图负责承接正文节奏，让内容从封面自然过渡到正文。",
					ordered: [
						"先让页面在首屏把结构稳定住。",
						"再让图片和段落逐步进入视线。",
						"最后把阅读节奏交给留白和目录。",
					],
					closing: "这一条更像是整套动态系统的开场白，核心不是堆效果，而是让页面先具备专业内容页应有的秩序。",
				},
			),
			presentationVersion: ACTIVITY_PRESET_VERSION,
			createdAt: now - 86400000 * 5,
			updatedAt: now - 86400000 * 5,
			images: [
				{
					url: getLocalActivityGalleryUrl("1.webp"),
					alt: "图集 01 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-002",
			slug: "gallery-note-02",
			title: "图集手记 02｜把注意力重新收回来",
			excerpt: "第二组图文更适合写整理和回收注意力的瞬间。",
			content: "图集手记 02，把注意力重新收回来。",
			body: createActivityBody(
				{
					heading: "图集手记 02｜把注意力重新收回来",
					leadImageUrl: getLocalActivityGalleryUrl("2.webp"),
					leadImageAlt: "图集 02 对应配图",
					leadImageCaption: "第二组图适合承接整理、聚焦和回收注意力的气氛。",
					intro: "内容一旦开始讲究层级和节奏，人的注意力也会更容易落回页面本身，而不是被杂项视觉打断。",
					sectionTitle: "阅读体验的核心变化",
					sectionParagraph: "这次把段落 hover、高亮反馈和图片懒加载做成统一体验，用户在不同设备上都能更快进入内容状态。",
					quote: "好的动态页不是把所有元素都推到最前，而是让真正重要的内容自然浮出来。",
					bullets: [
						"列表卡片先展示关键信息，不再只像一个普通文本块。",
						"详情页用标题锚点和目录定位，减少长内容迷路感。",
						"交互动作尽量压到轻量级，避免为了动画牺牲响应速度。",
					],
					codeLang: "js",
					code: 'const state = {\n  activeSlug: "gallery-note-02",\n  pending: false,\n  updatedAt: Date.now(),\n};\n\nrequestAnimationFrame(() => render(state));',
					galleryTitle: "把聚焦感延续下去",
					galleryImageUrl: getLocalActivityGalleryUrl("3.webp"),
					galleryImageAlt: "图集 03 补充配图",
					galleryImageCaption: "用另一张更安静的图继续承接正文后的情绪。",
					ordered: [
						"先让信息架构变清楚。",
						"再让交互动效退到内容之后。",
						"最后把视觉噪音降到最低。",
					],
					closing: "这一条的重点是提醒自己，所谓现代化升级不是多放组件，而是让每个组件都只做必要的事。",
				},
			),
			presentationVersion: ACTIVITY_PRESET_VERSION,
			createdAt: now - 86400000 * 4,
			updatedAt: now - 86400000 * 4,
			images: [
				{
					url: getLocalActivityGalleryUrl("2.webp"),
					alt: "图集 02 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-003",
			slug: "gallery-note-03",
			title: "图集手记 03｜留一段安静给自己",
			excerpt: "第三条动态保留了一点空白感，适合写慢下来之后的情绪。",
			content: "图集手记 03，留一段安静给自己。",
			body: createActivityBody(
				{
					heading: "图集手记 03｜留一段安静给自己",
					leadImageUrl: getLocalActivityGalleryUrl("3.webp"),
					leadImageAlt: "图集 03 对应配图",
					leadImageCaption: "第三张图更适合承接安静、缓慢、留白感更强的段落。",
					intro: "统一图库路径之后，详情页终于不再像临时拼接出来的内容块，图文关系也更稳定，读起来不会跳。",
					sectionTitle: "为什么要保留空白",
					sectionParagraph: "空白不是浪费空间，而是让每一个段落、标题和图像都拥有清晰边界，尤其在白底页面里更重要。",
					quote: "阅读舒适度往往不是来自更多信息，而是来自更少的干扰。",
					bullets: [
						"白色背景下必须加强边界和层次，否则很容易误判成没加载出来。",
						"段落 hover 只做轻微偏移，不破坏排版整体稳定性。",
						"图片进入动画控制在短时长内，避免拖慢阅读节奏。",
					],
					codeLang: "css",
					code: ".activity-content-block:hover {\n  background: color-mix(in oklch, var(--deep-text) 4%, #fff);\n  transform: translateX(4px);\n}",
					galleryTitle: "给留白一个落点",
					galleryImageUrl: getLocalActivityGalleryUrl("4.webp"),
					galleryImageAlt: "图集 04 补充配图",
					galleryImageCaption: "一张更有复盘感的图，用来压住整体节奏。",
					ordered: [
						"先解决视觉边界不足的问题。",
						"再保证滚动过程里信息层次始终稳定。",
						"最后让用户注意力落在真正的内容上。",
					],
					closing: "这条动态更像一次节奏测试，确认白底、边框、阴影和留白之间已经能形成足够清楚的结构感。",
				},
			),
			presentationVersion: ACTIVITY_PRESET_VERSION,
			createdAt: now - 86400000 * 3,
			updatedAt: now - 86400000 * 3,
			images: [
				{
					url: getLocalActivityGalleryUrl("3.webp"),
					alt: "图集 03 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-004",
			slug: "gallery-note-04",
			title: "图集手记 04｜把情绪也顺手整理一下",
			excerpt: "第四条图文更适合写回顾、复盘和把情绪放稳的片段。",
			content: "图集手记 04，把情绪也顺手整理一下。",
			body: createActivityBody(
				{
					heading: "图集手记 04｜把情绪也顺手整理一下",
					leadImageUrl: getLocalActivityGalleryUrl("4.webp"),
					leadImageAlt: "图集 04 对应配图",
					leadImageCaption: "第四组图更适合承接回顾、复盘和情绪整理。",
					intro: "删掉抢视线的黑色人物贴图和多余挂件之后，页面终于能让内容本身站在前面，视觉重心也稳定了下来。",
					sectionTitle: "这次顺手修掉的问题",
					sectionParagraph: "除了富文本和样式重构，顺便也把详情页里会破坏沉浸感的干扰项做了隔离，避免用户点进来后被异常元素打断。",
					quote: "真正让人记住一条动态的，通常不是装饰，而是它被认真对待过的排版和顺序。",
					bullets: [
						"详情页进入后主动关闭 Live2D 相关干扰。",
						"保留可返回列表的稳定入口，降低来回切换成本。",
						"让目录在内容较长时承担导航角色，而不是只当摆设。",
					],
					codeLang: "bash",
					code: "pnpm exec astro check\npnpm dev --host 127.0.0.1 --port 4321",
					galleryTitle: "让复盘段落有画面",
					galleryImageUrl: getLocalActivityGalleryUrl("5.webp"),
					galleryImageAlt: "图集 05 补充配图",
					galleryImageCaption: "第五张图更亮一些，适合拿来承接复盘后的回暖。",
					ordered: [
						"先清掉明显的视觉 bug。",
						"再把正文结构和导航补齐。",
						"最后才给页面增加轻量动效。",
					],
					closing: "这一条更多是在做体验收束，让内容层、交互层和视觉层开始朝同一个方向收口。",
				},
			),
			presentationVersion: ACTIVITY_PRESET_VERSION,
			createdAt: now - 86400000 * 2,
			updatedAt: now - 86400000 * 2,
			images: [
				{
					url: getLocalActivityGalleryUrl("4.webp"),
					alt: "图集 04 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-005",
			slug: "gallery-note-05",
			title: "图集手记 05｜白天和灵感都在慢慢变亮",
			excerpt: "第五条动态用来接住白天里那些逐渐变清晰的小想法。",
			content: "图集手记 05，白天和灵感都在慢慢变亮。",
			body: createActivityBody(
				{
					heading: "图集手记 05｜白天和灵感都在慢慢变亮",
					leadImageUrl: getLocalActivityGalleryUrl("5.webp"),
					leadImageAlt: "图集 05 对应配图",
					leadImageCaption: "这张图更明亮，适合放在靠后的动态里承接灵感感。",
					intro: "当图片、字号层级和段落间距终于开始协同，动态页就不再只是“能看”，而是第一次真正有了持续阅读的可能。",
					sectionTitle: "视觉升级在做什么",
					sectionParagraph: "这次把色彩压回纯白和深色文本的组合，把层次更多交给边框、阴影和间距，而不是高饱和色块。",
					quote: "让内容变亮，不一定要提高颜色饱和度，很多时候只需要把杂音拿掉。",
					bullets: [
						"纯白背景保持不变，符合当前项目整体审美方向。",
						"标题层级和字重重新分配，正文更像文章页而不是卡片备注。",
						"列表页与详情页统一同一套阅读语气和留白规则。",
					],
					codeLang: "json",
					code: '{\n  "theme": "pure-white",\n  "firstScreenTarget": "<1.5s",\n  "interactionDelay": "<100ms",\n  "lazyLoad": true\n}',
					galleryTitle: "把亮一点的状态接下去",
					galleryImageUrl: getLocalActivityGalleryUrl("6.webp"),
					galleryImageAlt: "图集 06 补充配图",
					galleryImageCaption: "用更完整的一张图给后半段内容做视觉收束。",
					ordered: [
						"保持白底和深文字的稳定关系。",
						"用留白和卡片层次代替花哨装饰。",
						"确保不同设备下排版仍然完整。",
					],
					closing: "这条动态主要在验证视觉升级是否真的提升了可读性，而不是只换了一层更时髦的外壳。",
				},
			),
			presentationVersion: ACTIVITY_PRESET_VERSION,
			createdAt: now - 86400000,
			updatedAt: now - 86400000,
			images: [
				{
					url: getLocalActivityGalleryUrl("5.webp"),
					alt: "图集 05 对应配图",
					source: "manual",
				},
			],
		},
		{
			id: "activity-006",
			slug: "gallery-note-06",
			title: "图集手记 06｜把今天收进最后一张图里",
			excerpt: "最后一条动态收尾，把整批图文记录落到统一的本地图库规则上。",
			content: "图集手记 06，把今天收进最后一张图里。",
			body: createActivityBody(
				{
					heading: "图集手记 06｜把今天收进最后一张图里",
					leadImageUrl: getLocalActivityGalleryUrl("6.webp"),
					leadImageAlt: "图集 06 对应配图",
					leadImageCaption: "最后一张图负责整组内容的收尾和落点。",
					intro: "这一轮动态系统升级到这里，终于从“能展示”走到了“值得读完”。组件化、异步加载、目录联动和轻量动画已经开始协同工作。",
					sectionTitle: "最终想保留下来的能力",
					sectionParagraph: "一套现代动态系统不应该只靠写死 HTML 堆出来，而要能让内容结构、视觉风格和交互体验用同一条数据链路产出。",
					quote: "当内容、组件和数据流开始对齐，页面才会稳定地好看，而不是偶尔好看。",
					bullets: [
						"详情页支持更接近专业文章的结构化排版。",
						"列表页和详情页共享同一套数据、缓存和图片策略。",
						"整体仍然保持轻量，不因为升级而牺牲首屏速度。",
					],
					codeLang: "ts",
					code: 'export const performanceGoal = {\n  firstPaint: "<1.5s",\n  interactionDelay: "<100ms",\n  compatibility: "stable",\n};',
					galleryTitle: "给这轮升级一个收尾画面",
					galleryImageUrl: getLocalActivityGalleryUrl("1.webp"),
					galleryImageAlt: "图集 01 回收配图",
					galleryImageCaption: "把第一张图重新放回结尾，形成一轮完整的视觉闭环。",
					ordered: [
						"继续验证真实设备下的滚动与加载状态。",
						"必要时再补更细的性能采样。",
						"最后把改动整理并推送备份。",
					],
					closing: "这条作为整组动态的收尾，负责把视觉、交互、内容和性能目标重新收束到同一套现代化展示系统里。",
				},
			),
			presentationVersion: ACTIVITY_PRESET_VERSION,
			overview: {
				readingMinutes: 2,
				sectionCount: 4,
				imageCount: 2,
				updatedLabel: "2026-07-11 19:04",
			},
			createdAt: GALLERY_NOTE_06_UPDATED_AT - 3600000 * 6,
			updatedAt: GALLERY_NOTE_06_UPDATED_AT,
			images: [
				{
					url: getLocalActivityGalleryUrl("6.webp"),
					alt: "图集 06 对应配图",
					source: "manual",
				},
			],
		},
	];
}

export function shouldResetActivities(items: ActivityRecord[]): boolean {
	if (!Array.isArray(items) || items.length === 0) return true;
	const onlyPresetGalleryItems = items.every((item) =>
		String(item.slug || "").startsWith("gallery-note-"),
	);
	if (
		onlyPresetGalleryItems &&
		items.some((item) => item.presentationVersion !== ACTIVITY_PRESET_VERSION)
	) {
		return true;
	}
	return items.some((item) => {
		const images = Array.isArray(item.images) ? item.images : [];
		const body = String(item.body || item.content || "");
		const hasLocalImage = images.some((image) =>
			String(image?.url || "").startsWith(LOCAL_ACTIVITY_IMAGE_PREFIX),
		);
		const looksModernEnough =
			/^#{2,4}\s/m.test(body) &&
			/```[\s\S]*?```/.test(body) &&
			/^>\s/m.test(body) &&
			/^[-*]\s/m.test(body) &&
			/^\d+\.\s/m.test(body);
		return !hasLocalImage || !body.includes(LOCAL_ACTIVITY_IMAGE_PREFIX) || (onlyPresetGalleryItems && !looksModernEnough);
	});
}
