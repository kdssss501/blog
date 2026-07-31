export interface HolidayEntry {
	date: string;
	name: string;
	isOfficial?: boolean;
	isWorkday?: boolean;
	icon?: string;
	source: "api" | "builtin";
	rest?: number;
}
