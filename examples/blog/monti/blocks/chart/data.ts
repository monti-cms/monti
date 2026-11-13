import type { Block } from "@monti-cms/core";

export const KINDS = ["bar", "line", "area", "pie"] as const;
export type ChartKind = (typeof KINDS)[number];

/** What a chart draws, read from its table: the first column names the points, each other column is a series named by its head. */
export type ChartData = {
	categories: string[];
	series: { name: string; values: (number | null)[] }[];
	/** Cells of a series that are not numbers (row, column of the table): drawn as gaps, and said in the publish to-do list. */
	notNumbers: { row: number; column: number }[];
};

/** A cell as a number: digits with a sign, a point, thousands commas or spaces, and a % at the end. An empty cell is a gap, not a mistake. */
export function cellNumber(cell: string): number | null | "not" {
	const text = cell.trim().replace(/[,\s]/g, "").replace(/%$/, "");
	if (text === "") return null;
	return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(text) ? Number(text) : "not";
}

/** The table a chart holds, read as its data. With no table, or a table of one row or one column, it draws nothing. */
export function chartData(block: Block): ChartData {
	const table = (block.children ?? []).find((child) => child.type === "table");
	const rows = (Array.isArray(table?.attrs?.rows) ? table.attrs.rows : []) as string[][];
	const [head = [], ...body] = rows;
	const notNumbers: ChartData["notNumbers"] = [];
	const series = head.slice(1).map((name, at) => ({
		name: String(name),
		values: body.map((row, index) => {
			const value = cellNumber(String(row[at + 1] ?? ""));
			if (value === "not") notNumbers.push({ row: index + 1, column: at + 1 });
			return value === "not" ? null : value;
		}),
	}));
	return { categories: body.map((row) => String(row[0] ?? "")), series, notNumbers };
}
