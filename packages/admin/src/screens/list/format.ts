import type { ListColumn, ListRow } from "@monti-cms/core";

const two = (value: number) => String(value).padStart(2, "0");

/** A list date: "10. 26" this year, "25. 08. 03" before (the column is as wide as the short one, doc 06 columns). */
export function shortDate(value: Date | string | null, now = new Date()): string {
	if (value === null) return "";
	const date = new Date(value);
	const day = `${two(date.getMonth() + 1)}. ${two(date.getDate())}`;
	return date.getFullYear() === now.getFullYear() ? day : `${two(date.getFullYear() % 100)}. ${day}`;
}

/** "KO", or "KO +1" when the row's group has other languages (doc 06, principle 4). */
export const localeCell = (row: ListRow) =>
	`${row.locale.toUpperCase()}${row.locales.length > 1 ? ` +${row.locales.length - 1}` : ""}`;

/** What a field's cell reads: relation titles or option labels joined, or the text. */
export function fieldCell(row: ListRow, column: ListColumn): string {
	if (column.kind === "relation") return (row.relations[column.id] ?? []).map((target) => target.title).join(" · ");
	const value = row.values[column.id];
	if (column.kind === "select") {
		const chosen = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
		return chosen
			.map((option) => column.options?.find((each) => each.value === option)?.label ?? String(option))
			.join(" · ");
	}
	return typeof value === "string" ? value : "";
}

/**
 * Whether a name ends in a closed syllable (a Hangul syllable with a final consonant), which picks the subject particle the dictionary adds
 * ("memo" takes "ga", "post" takes "i" in Korean). A name that does not end in Hangul counts as closed.
 */
export function endsClosed(name: string): boolean {
	const last = name.charCodeAt(name.length - 1);
	return last < 0xac00 || last > 0xd7a3 || (last - 0xac00) % 28 !== 0;
}
