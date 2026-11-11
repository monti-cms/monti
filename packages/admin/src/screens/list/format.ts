import type { ListColumn, ListRow } from "@monti-cms/core";

const two = (value: number) => String(value).padStart(2, "0");

/** A list date: "10. 26" this year, "25. 08. 03" before (the column is as wide as the short one, doc 06 columns). */
export function shortDate(value: Date | string | null, now = new Date()): string {
	if (value === null) return "";
	const date = new Date(value);
	const day = `${two(date.getMonth() + 1)}. ${two(date.getDate())}`;
	return date.getFullYear() === now.getFullYear() ? day : `${two(date.getFullYear() % 100)}. ${day}`;
}

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
 * Whether a name ends in a closed syllable (a Hangul syllable with a final consonant, or a Latin/digit character read with a final consonant in
 * Korean: l, m, n, r, 0, 1, 3, 6, 7, 8), which picks the particle the dictionary adds ("memo" takes "ga", "post" takes "i", "React" takes "reul").
 */
export function endsClosed(name: string): boolean {
	const trimmed = name.trim();
	if (!trimmed) return false;
	const last = trimmed.charCodeAt(trimmed.length - 1);
	if (last >= 0xac00 && last <= 0xd7a3) return (last - 0xac00) % 28 !== 0;
	return /[lmnrLMNR013678]$/.test(trimmed);
}

/**
 * Whether a name takes the closed instrumental particle ("euro" vs "ro" in Korean): a closed syllable that does not end in rieul (jongseong 8, or 'l').
 */
export function endsDirectionClosed(name: string): boolean {
	const trimmed = name.trim();
	if (!trimmed) return false;
	const last = trimmed.charCodeAt(trimmed.length - 1);
	if (last >= 0xac00 && last <= 0xd7a3) {
		const jong = (last - 0xac00) % 28;
		return jong !== 0 && jong !== 8;
	}
	return /[mnrMNR036]$/.test(trimmed);
}

/** A list's column widths after `ListHead` changes some; `null` takes one back to its kind's. */
export const widthsAfter = (current: Record<string, number>, changes: Record<string, number | null>) =>
	Object.fromEntries(
		Object.entries({ ...current, ...changes }).filter((entry): entry is [string, number] => entry[1] !== null),
	);
