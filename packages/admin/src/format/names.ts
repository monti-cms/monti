// What a thing is called when its own name is missing or is not a word: a title, a field, a file's kind. Every screen asks here, so the same thing has
// the same name everywhere and an id is never shown as one.
import type { Label, ListColumn, ListRow } from "@monti-cms/core";

export type Translate = (message: Label) => string;

/** A title as every screen writes it: the title, or the list's word for one that is empty ("Untitled"). */
export const titleOf = (title: string | null | undefined, t: Translate): string =>
	title?.trim() ? title : t("list.untitled");

/**
 * The address of a choice that shares its name with another of the shown choices: what tells the two apart, written after the name as a list
 * row's address is. Nothing for a name that stands alone, or a choice with no address.
 */
export function addressIfShared<Option extends { group: string; title: string; slug: string }>(
	option: Option,
	shown: readonly Option[],
	t: Translate,
): string | null {
	if (!option.slug) return null;
	const name = (each: Option) => titleOf(each.title, t).trim().toLowerCase();
	return shown.some((each) => each.group !== option.group && name(each) === name(option)) ? option.slug : null;
}

/** The two fields every collection has, called what the list and the settings call them. */
const FIXED_FIELDS: Record<string, "list.column.title" | "settings.field.kind.slug"> = {
	title: "list.column.title",
	slug: "settings.field.kind.slug",
};

/** A field's name: the word of a fixed field ("Title", "Address"), then the label the schema gives it, then its id. */
export function fieldName(id: string, label: string | null | undefined, t: Translate): string {
	const fixed = Object.hasOwn(FIXED_FIELDS, id) ? FIXED_FIELDS[id] : undefined;
	return fixed ? t(fixed) : label || id;
}

/** A collection's name: the label the admin values give it, else its id. Every screen asks here. */
export const labelOfCollection = (
	adminValues: Readonly<Record<string, { label?: string }>> | null | undefined,
	id: string,
): string => adminValues?.[id]?.label || id;

/** "PDF": what a file's preview says it is, from its name. */
export const extensionLabel = (name: string) => {
	const dot = name.lastIndexOf(".");
	return dot > 0 ? name.slice(dot + 1).toUpperCase() : "";
};

/** What a field's cell reads: relation titles or option labels joined, or the text. */
export function fieldCell(row: ListRow, column: ListColumn, t: Translate): string {
	if (column.kind === "relation")
		return (row.relations[column.id] ?? []).map((target) => titleOf(target.title, t)).join(" · ");
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
