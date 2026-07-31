import type { HomeConfig } from "../types/config";
import { wallpaperConfig } from "./wallpaperConfig";

export const homeConfig: HomeConfig = {
	// 头像
	// 图片路径支持三种格式：
	// 1. public 目录（以 "/" 开头，不优化）："/assets/images/avatar.webp"
	// 2. src 目录（不以 "/" 开头，自动优化但会增加构建时间，推荐）："assets/images/avatar.webp"
	// 3. 远程 URL："https://example.com/avatar.jpg"
	avatar: "assets/images/avatar.webp",

	// 上班时间头像（为空则使用上方 avatar）
	avatarOnWork: "/assets/images/home/avatar-work-on.gif",

	// 下班时间头像（为空则始终使用上方 avatar）
	avatarOffWork: "assets/images/avatar-work-off.webp",

	// 名字
	name: "kdssss",

	// 首页展示名字（留空则使用 name）
	displayName: "kdssss",

	// 名字右侧徽章文字（如 QQ 号）
	nameBadge: "",

	// 职业/身份标签
	occupation: "技术博主",

	// 个人签名（支持多条，会循环打字+删除效果）
	bio: ["记录学习与生活的点滴"],

	hero: {
		backgroundImage: "/assets/illustrations/fate-throne/59561306-p0.webp",
		backgroundImageMobile: "/assets/illustrations/fate-throne/59561306-p0.webp",
		characterImage: "/assets/images/home/saber-gilgamesh-pixel.png",
		speechAccentImage: "/assets/images/home/home2-1.webp",
		rightPanel: {
			pill: "BLOG",
			title: "博客",
			diamond: "✦",
			subtitle: "CREATIVE",
			microText: "システム起動完了",
		},
		// 玻璃雨珠 + 撞击水花（仅桌面端生效，自动尊重 prefers-reduced-motion）
		rain: {
			enabled: true,
			intensity: 0.6,
			// 留空则随主题自动取色（暗色→白 / 浅色→深灰）；也可填 "#7fb0ff" 或 "127,176,255"
			color: "#ffffff",
		},
	},

	dataLayer: {
		visitImage: "/assets/images/home/home-data-1.webp",
		archiveImage: "/assets/images/home/home-data-2.webp",
		contactImage: "/assets/images/home/home-data-3.webp",
		skillsImage: "/assets/images/home/home-data-4.webp",
	},

	// 展示层：垂直线 → 长柱 → 字体显隐 → 柱子扩全屏 → 衔接百叶窗
	displayLayer: {
		enabled: true,
		kicker: "展示",
		title: "CRYSTALLIZE GALLERY",
		description:
			"Where fleeting visions crystallize into permanence — each frame a frozen breath of time, each work a memory hardened into light.",
		scrollDistance: 4600,
		pillarFinalWidth: "18vw",
		emitterImage: "/assets/images/home-truncated/td.webp",
	},

	portfolioShutter: {
		enabled: true,
		kicker: "The End",
		title: "愿你每一天 都闪闪发光",
		description: "岁岁常欢愉，万事皆胜意",
		scrollDistance: 12000,
		finalImage: {
			midgroundImage: "/assets/images/home-truncated/utl-back1.webp",
			backgroundVideo: "/assets/images/home-truncated/utl-back2.webm",
			foregroundImage: "/assets/images/home-truncated/utl-1.webp",
			alt: "2026年 加油！",
		},
		interlude: {
			foreground: "/assets/images/home-truncated/b-1.webp",
			foregroundAlt: "第二幕中央透明人物",
			foregroundWidth: "min(56vw, 70rem)",
			stripLeft: "/assets/images/home-truncated/b-2.webp",
			stripRight: "/assets/images/home-truncated/b-3.webp",
			copyLeft: "初心",
			copyRight: "前行",
		},
		panels: [
			{
				title: "间桐樱",
				english: "SAKURA",
				description: "Fate · 命运王座",
				image: "/assets/illustrations/fate-throne/98522947-p0.webp",
				alt: "间桐樱",
			},
			{
				title: "远坂凛",
				english: "RIN Tohsaka",
				description: "Fate · 魔术与旅途",
				image: "/assets/illustrations/fate-throne/89514781-p0.webp",
				alt: "远坂凛",
			},
			{
				title: "Saber Alter",
				english: "ALTER",
				description: "Fate · 黑色圣剑",
				image: "/assets/illustrations/fate-throne/84782057-p0.webp",
				alt: "Saber Alter",
			},
			{
				title: "远坂凛",
				english: "RIN",
				description: "Fate · 红色的魔术师",
				image: "/assets/illustrations/fate-throne/87446888-p0.webp",
				alt: "远坂凛",
			},
			{
				title: "Saber",
				english: "SABER",
				description: "Fate · 铠甲与誓约",
				image: "/assets/illustrations/fate-throne/101297457-p0.webp",
				alt: "Saber",
			},
		],
		cinematicStory: {
			sourceVideo: "/assets/videos/artoria-original.mp4",
			frames: [
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-01.webp",
					sourceTime: 0.05,
					caption: "风从很远的地方来，替她擦亮了剑锋。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-02.webp",
					sourceTime: 0.65,
					caption: "她把沉默握在手中，像握住一场未醒的黎明。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-03.webp",
					sourceTime: 1.25,
					caption: "光穿过旧日，留下一个尚未说完的名字。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-04.webp",
					sourceTime: 1.8,
					caption: "当世界褪成纯白，她仍沿着誓言前行。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-05.webp",
					sourceTime: 2.35,
					caption: "没有掌声的时刻，也值得郑重地站立。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-06.webp",
					sourceTime: 2.9,
					caption: "每一次回身，都是命运重新落笔。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-07.webp",
					sourceTime: 3.45,
					caption: "她学会在迟疑之前，先迈出一步。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-08.webp",
					sourceTime: 4,
					caption: "风追上裙摆，时间却被留在身后。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-09.webp",
					sourceTime: 4.55,
					caption: "背对人群时，心仍朝着那束光。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-10.webp",
					sourceTime: 4.72,
					caption: "同一把剑，也曾映照过不同的夜。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-11.webp",
					sourceTime: 5.05,
					caption: "火焰记得她的名字，城市记得她的影子。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-12.webp",
					sourceTime: 5.22,
					caption: "有些告别，不在终点，而在选择发生的那一刻。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-13.webp",
					sourceTime: 5.55,
					caption: "王座很高，高不过她不肯低下的目光。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-14.webp",
					sourceTime: 5.72,
					caption: "偶尔也让海风，把战争吹得远一些。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-15.webp",
					sourceTime: 6.05,
					caption: "花环不是冠冕，只是春天短暂的拥抱。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-16.webp",
					sourceTime: 6.22,
					caption: "冬雪落下时，愿旧伤终于有了温度。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-17.webp",
					sourceTime: 6.55,
					caption: "星海辽阔，仍装得下一颗固执的心。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-18.webp",
					sourceTime: 6.72,
					caption: "人间的橱窗亮起，她也只是路过寻常的一天。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-19.webp",
					sourceTime: 7.05,
					caption: "褪下盔甲以后，脚步仍知道归途。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-20.webp",
					sourceTime: 7.55,
					caption: "黄昏替她换上白裙，也替往事按下静音。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-21.webp",
					sourceTime: 8.1,
					caption: "她从光里走来，不问故事是否有人记得。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-22.webp",
					sourceTime: 8.65,
					caption: "原野没有挽留，风却一直跟随。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-23.webp",
					sourceTime: 9.2,
					caption: "直到身影走远，春天才慢慢合上眼睛。",
				},
				{
					image: "/assets/images/home/artoria-scroll-4k/frame-24.webp",
					sourceTime: 9.82,
					caption: "最后留在画面里的，是她曾经来过的风。",
				},
			],
		},
	},

	// 首页技能图标
	photoDeck: {
		enabled: true,
		title: "WUTHERING WAVES",
		subtitle: "四段潮声，在光影之间循环",
		autoplayMs: 5200,
		photos: wallpaperConfig.slides.map((slide) => ({ ...slide })),
	},

	skills: [
		{ name: "Astro", icon: "simple-icons:astro", group: "Frontend" },
		{ name: "Svelte", icon: "simple-icons:svelte", group: "Frontend" },
		{ name: "TypeScript", icon: "simple-icons:typescript", group: "Language" },
		{ name: "React", icon: "simple-icons:react", group: "Frontend" },
		{ name: "Tailwind", icon: "simple-icons:tailwindcss", group: "Style" },
		{ name: "Java", icon: "mdi:language-java", group: "Backend" },
		{ name: "Python", icon: "simple-icons:python", group: "Language" },
		{ name: "Spring", icon: "simple-icons:spring", group: "Backend" },
		{ name: "Redis", icon: "simple-icons:redis", group: "Storage" },
		{ name: "MySQL", icon: "simple-icons:mysql", group: "Storage" },
		{ name: "MongoDB", icon: "simple-icons:mongodb", group: "Storage" },
		{ name: "RabbitMQ", icon: "simple-icons:rabbitmq", group: "Backend" },
		{ name: "Docker", icon: "simple-icons:docker", group: "DevOps" },
		{ name: "Linux", icon: "simple-icons:linux", group: "DevOps" },
		{ name: "Nginx", icon: "simple-icons:nginx", group: "DevOps" },
	],

	// 链接配置
	// 已经预装的图标集：fa7-brands，fa7-regular，fa7-solid，material-symbols，simple-icons
	// 访问https://icones.js.org/ 获取图标代码，
	// 如果想使用尚未包含相应的图标集，则需要安装它
	// `pnpm add @iconify-json/<icon-set-name>`
	// showName: true 时显示图标和名称，false 时只显示图标
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/kdssss",
			showName: false,
		},
		{
			name: "Email",
			icon: "fa7-solid:envelope",
			url: "mailto:3296379498@qq.com",
			showName: false,
		},
		{
			name: "RSS",
			icon: "fa7-solid:rss",
			url: "/rss/",
			showName: false,
		},
	],
};
