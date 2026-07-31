const SKILL_ICON_MAP = {
	astro: "simple-icons:astro",
	docker: "simple-icons:docker",
	git: "simple-icons:git",
	java: "simple-icons:openjdk",
	javascript: "simple-icons:javascript",
	linux: "simple-icons:linux",
	mongodb: "simple-icons:mongodb",
	mysql: "simple-icons:mysql",
	nginx: "simple-icons:nginx",
	python: "simple-icons:python",
	react: "simple-icons:react",
	redis: "simple-icons:redis",
	spring: "simple-icons:spring",
	tailwind: "simple-icons:tailwindcss",
	typescript: "simple-icons:typescript",
};

export function countReadableCharacters(body = "") {
	const text = String(body)
		.replace(/```[\s\S]*?```/g, "")
		.replace(/`[^`]*`/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const cn = text.match(/[一-龥]/g) || [];
	const en = text.match(/[a-zA-Z]/g) || [];
	return cn.length + en.length;
}

export function formatCompactNumber(value) {
	if (value === null || value === undefined || Number.isNaN(Number(value))) {
		return "--";
	}
	const number = Number(value);
	if (Math.abs(number) < 1000) return String(number);
	const compact = number / 1000;
	const rounded = Number.isInteger(compact)
		? compact.toFixed(0)
		: compact.toFixed(1);
	return `${rounded}k`;
}

function inferSkillIcon(name) {
	const key = String(name).trim().toLowerCase();
	return SKILL_ICON_MAP[key] || "material-symbols:code-blocks-outline";
}

export function normalizeSkillItems(config = {}) {
	const explicitItems = Array.isArray(config.items) ? config.items : [];
	const groupedSkills = Array.isArray(config.skills) ? config.skills : [];

	const fromGroups = groupedSkills.flatMap((group) => {
		if (!Array.isArray(group)) return [];
		return group.map((name) => ({
			name,
			icon: inferSkillIcon(name),
			group: undefined,
		}));
	});

	return [...explicitItems, ...fromGroups].filter((item) => item?.name);
}
