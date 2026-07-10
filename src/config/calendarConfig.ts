import type { CalendarConfig } from "../types/config";

// 日历页面配置
// 节日数据来源：timor.tech API（构建时拉取）+ builtinHolidays 内置补充
// 生日 / 安排支持公历或农历（农历需 type: "lunar"，会自动换算为当年公历日期）
export const calendarConfig: CalendarConfig = {
	// 页面标题，留空使用 i18n 翻译
	title: "",
	// 页面描述，留空使用 i18n 翻译
	description: "",

	// 节日 API（构建时拉取并缓存，运行时无网络依赖）
	holidayApi: {
		// 是否启用 API 拉取
		enable: true,
		// timor.tech 中国法定节假日 API（含调休、补班）
		url: "https://timor.tech/api/holiday/year/",
		// 拉取失败时是否仅用 builtinHolidays 兜底
		fallbackOnError: true,
		// 编译期拉取哪些年（按需扩展）
		years: [2026, 2027],
	},

	// 内置补充节日 — 用于补 API 不覆盖的项（农历传统节日、节气、私人纪念日等）
	// type:"solar" 公历月日，type:"lunar" 农历月日，每年自动渲染
	builtinHolidays: [
		{
			name: "春节",
			date: { type: "lunar", month: 1, day: 1 },
			icon: "material-symbols:festival",
		},
		{
			name: "元宵节",
			date: { type: "lunar", month: 1, day: 15 },
			icon: "material-symbols:lightbulb",
		},
		{
			name: "端午节",
			date: { type: "lunar", month: 5, day: 5 },
			icon: "material-symbols:rowing",
		},
		{
			name: "七夕",
			date: { type: "lunar", month: 7, day: 7 },
			icon: "material-symbols:favorite",
		},
		{
			name: "中秋节",
			date: { type: "lunar", month: 8, day: 15 },
			icon: "material-symbols:nightlight",
		},
		{
			name: "重阳节",
			date: { type: "lunar", month: 9, day: 9 },
			icon: "material-symbols:hiking",
		},
		{
			name: "腊八节",
			date: { type: "lunar", month: 12, day: 8 },
			icon: "material-symbols:soup-kitchen",
		},
	],

	// 生日 / 纪念日 — 按年重复
	birthdays: [
		{
			name: "我的生日",
			date: { type: "solar", month: 7, day: 10 },
			icon: "material-symbols:cake",
			note: "又长大一岁",
		},
		{
			name: "建站日",
			date: { type: "solar", month: 5, day: 7 },
			icon: "material-symbols:rocket-launch",
			note: "kdssss的博客上线纪念日",
		},
	],

	// 自定义安排 — 支持一次性 / 每年 / 每月 / 每周
	schedules: [
		// 一次性安排示例
		// { title: "毕业答辩", date: "2026-06-15", note: "记得带身份证" },
		// 每周安排示例（weekday: 0=周日, 1=周一 ... 6=周六）
		// { title: "周报提交", recurring: { freq: "weekly", weekday: 5 } },
		// 每月安排示例
		// { title: "月度复盘", recurring: { freq: "monthly", day: 28 } },
		// 每年（农历）安排示例
		// { title: "祭祖", recurring: { freq: "yearly", month: 4, day: 5, lunar: false } },
		{ title: "python 学习", date: "2026-05-20", note: "开始学习Python" },

		{ title: "python 学习", date: "2026-05-22", note: "Python数据类型" },
		{ title: "python 学习", date: "2026-05-23", note: "Python流程控制" },
		{ title: "python 学习", date: "2026-05-24", note: "Python函数" },
		{ title: "python 学习", date: "2026-05-25", note: "Python模块" },
		{ title: "python 学习", date: "2026-05-26", note: "Python文件操作" },
		{ title: "python 学习", date: "2026-05-27", note: "Python面向对象" },
		{ title: "python 学习", date: "2026-05-28", note: "Python异常处理" },
		{ title: "python 学习", date: "2026-05-29", note: "Python项目实战" },
		{ title: "python 学习", date: "2026-05-30", note: "Python总结复习" },
	],

	// 显示开关
	show: {
		// 是否把文章发布日上日历（type=post 事件）
		posts: true,
		// 单元格右上角是否显示农历日（廿一、初一等）
		lunarDate: true,
	},

	// 顶部"未来概览"配置
	overview: {
		// 概览跨度（天）
		futureDays: 30,
		// 卡片数上限
		maxItems: 6,
	},
};
