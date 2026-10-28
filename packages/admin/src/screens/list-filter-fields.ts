import type { FieldCondition, Site } from "@monti-cms/core/site";
import { valueFieldsOf } from "@monti-cms/core/site";

/** The kinds of stored field the list can filter by. An address, a view and a reverse relation have no filter (the address is found by search). */
export type FilterFieldKind = "text" | "media" | "select" | "relation";

/** One stored field as the filter menu offers it. */
export interface FilterField {
	readonly name: string;
	readonly label: string;
	readonly kind: FilterFieldKind;
	/** Collection the items of a relation come from. */
	readonly to?: string;
	/** The options of a select, in the order the schema declares them. */
	readonly options?: readonly { readonly value: string; readonly label: string }[];
}

/**
 * What each kind takes in the filter menu. A text or an image is only ever looked for when it is missing ("what still has no description"), so those take
 * only "empty" and are listed together under one "Blank" row; a select or a relation takes "none" and its values.
 */
const TAKES: Record<FilterFieldKind, readonly FieldCondition["kind"][]> = {
	text: ["empty"],
	media: ["empty"],
	select: ["empty", "is"],
	relation: ["empty", "is"],
};

/** Whether a field is found by being blank alone: a text or an image. */
export const isBlankField = (field: FilterField): boolean => field.kind === "text" || field.kind === "media";

/** Whether a field of this kind takes this kind of condition. */
export const takesCondition = (kind: FilterFieldKind, condition: FieldCondition["kind"]): boolean =>
	TAKES[kind].includes(condition);

/**
 * The fields the filter menu lists for a collection, in schema order: every stored text, media, select and relation field but the title (the title is found by
 * search). A conditional field is its choice, then the fields that depend on it, each by the rule of its own kind.
 */
export function filterFieldsOf(site: Site, collection: string): FilterField[] {
	if (!site.isCollection(collection)) return [];
	const schema = site.schemaOf(collection);
	const titleName = site.titleField(collection).name;
	return valueFieldsOf(schema).flatMap(({ name, field }): FilterField[] => {
		if (name === titleName) return [];
		switch (field.kind) {
			case "text":
			case "media":
				return [{ name, label: field.label, kind: field.kind }];
			case "select":
				return [
					{
						name,
						label: field.label,
						kind: "select",
						options: Object.entries(field.options).map(([value, label]) => ({ value, label: String(label) })),
					},
				];
			case "relation":
				return [{ name, label: field.label, kind: "relation", to: field.to }];
			default:
				return [];
		}
	});
}

export const filterFieldOf = (site: Site, collection: string, name: string): FilterField | undefined =>
	filterFieldsOf(site, collection).find((field) => field.name === name);

const sameCondition = (a: FieldCondition, b: FieldCondition) =>
	a.kind === b.kind && (a.kind !== "is" || (b.kind === "is" && a.value === b.value));

/** Whether the conditions of a field include this one. */
export const hasCondition = (conditions: readonly FieldCondition[] | undefined, condition: FieldCondition): boolean =>
	(conditions ?? []).some((candidate) => sameCondition(candidate, condition));

/**
 * The conditions of a field after the writer ticked or unticked one: they are OR, so a menu can tick "none" and an item together. `empty` and `filled` say
 * opposite things about one value, so ticking one drops the other.
 */
export function toggleCondition(
	conditions: readonly FieldCondition[] | undefined,
	condition: FieldCondition,
): FieldCondition[] {
	const current = conditions ?? [];
	if (hasCondition(current, condition)) return current.filter((candidate) => !sameCondition(candidate, condition));
	const rest =
		condition.kind === "empty"
			? current.filter((candidate) => candidate.kind !== "filled")
			: condition.kind === "filled"
				? current.filter((candidate) => candidate.kind !== "empty")
				: current;
	return [...rest, condition];
}

/** `name:empty`, `name:filled` or `name:is:value`: one condition as the address and the list API write it. */
export const writeCondition = (name: string, condition: FieldCondition): string =>
	condition.kind === "is" ? `${name}:is:${condition.value}` : `${name}:${condition.kind}`;

/** Reads what `writeCondition` writes. Anything else is `null`. */
export function readCondition(raw: string): { name: string; condition: FieldCondition } | null {
	const [name = "", kind = "", ...rest] = raw.split(":");
	if (name === "") return null;
	if ((kind === "empty" || kind === "filled") && rest.length === 0) return { name, condition: { kind } };
	const value = rest.join(":");
	return kind === "is" && value !== "" ? { name, condition: { kind, value } } : null;
}
