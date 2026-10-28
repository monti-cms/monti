import type { Site } from "@monti-cms/core/site";
import { collectionTranslated } from "./list-columns";
import type { DateFilter } from "./list-dates";
import { type FilterField, filterFieldsOf, isBlankField } from "./list-filter-fields";
import { shortDay } from "./list-row-dates";
import type { ListState } from "./list-state";
import { screensMessages } from "./messages";

/** A row of the filter menu's first level. */
export type FilterRow =
	| { readonly kind: "locale"; readonly label: string }
	| { readonly kind: "translation"; readonly label: string }
	| { readonly kind: "date"; readonly label: string }
	| { readonly kind: "field"; readonly label: string; readonly field: FilterField }
	| { readonly kind: "blank"; readonly label: string; readonly fields: readonly FilterField[] };

/**
 * The first level of the filter menu, in three groups with a rule between: the rows every list has; the fields that have values to pick (selects and
 * relations), in schema order; and one "Blank" row that lists the texts and images to find empty. Folders are not here: the sidebar filters them.
 */
export interface FilterRows {
	readonly top: FilterRow[];
	readonly fields: FilterRow[];
	readonly blank: FilterRow[];
}

/**
 * Language (with several languages), translation (when the translation screens are on) and date, then the fields. An item collection is never translated
 * as a whole, so it has neither; its date is the updated date only.
 */
export function filterRowsOf(site: Site, collection: string): FilterRows {
	const t = site.createTranslator(screensMessages);
	const documents = site.isCollection(collection) && site.isDocumentCollection(collection);
	const blankFields = filterFieldsOf(site, collection).filter(isBlankField);
	return {
		top: [
			...(documents && collectionTranslated(site, collection)
				? ([
						{ kind: "locale", label: t("listMenu.language") },
						{ kind: "translation", label: t("listMenu.translation") },
					] as const)
				: []),
			{ kind: "date", label: t("listMenu.date") },
		],
		fields: filterFieldsOf(site, collection)
			.filter((field) => !isBlankField(field))
			.map((field) => ({ kind: "field", label: field.label, field })),
		blank: blankFields.length > 0 ? [{ kind: "blank", label: t("listMenu.blank"), fields: blankFields }] : [],
	};
}

/** What "Find a filter" matches a row by: its name, the options a select offers and the fields "Blank" lists (each can be found without opening its row). */
export function rowTerms(row: FilterRow): string[] {
	if (row.kind === "field") return [row.label, ...(row.field.options?.map((option) => option.label) ?? [])];
	if (row.kind === "blank") return [row.label, ...row.fields.map((field) => field.label)];
	return [row.label];
}

/** Whether a row matches the text typed in "Find a filter" (ignoring case; an empty text matches every row). */
export function rowMatches(row: FilterRow, text: string): boolean {
	const query = text.trim().toLowerCase();
	return query === "" || rowTerms(row).some((term) => term.toLowerCase().includes(query));
}

/** One filter that is on, as the chip in the toolbar says it, and the change that takes it off. */
export interface FilterChip {
	readonly key: string;
	readonly label: string;
	readonly clear: Partial<ListState>;
}

/** The name of the date filter's value: a preset by its name, a range by its days. */
export function dateFilterLabel(site: Site, filter: DateFilter, now: Date = new Date()): string {
	const t = site.createTranslator(screensMessages);
	if (filter.kind === "range") {
		return t("listMenu.chipRange", { from: shortDay(site, filter.from, now), to: shortDay(site, filter.to, now) });
	}
	return t(`listMenu.${filter.preset}`);
}

/**
 * The chips of the filters that are on, in the order the menu lists them. `titles` names the items of a relation by id (`id` → title), which only the server
 * knows; an id it does not know yet shows as "…" until it does.
 */
export function filterChipsOf(
	site: Site,
	state: ListState,
	titles: ReadonlyMap<string, string>,
	now: Date = new Date(),
): FilterChip[] {
	const t = site.createTranslator(screensMessages);
	const chips: FilterChip[] = [];
	const add = (key: string, label: string, values: string, clear: Partial<ListState>) =>
		chips.push({ key, label: t("listMenu.chipValues", { label, values }), clear });
	if (state.locales.length > 0) {
		add("locale", t("listMenu.language"), state.locales.map((locale) => site.localeLabel(locale)).join(", "), {
			locales: [],
		});
	}
	if (state.translations.length > 0) {
		const names = {
			none: t("listMenu.translationNone"),
			changed: t("listMenu.translationChanged"),
			current: t("listMenu.translationCurrent"),
		};
		add("translation", t("listMenu.translation"), state.translations.map((value) => names[value]).join(", "), {
			translations: [],
		});
	}
	if (state.updated) {
		add("updated", t("listMenu.updated"), dateFilterLabel(site, state.updated, now), { updated: null });
	}
	if (state.published) {
		add("published", t("listMenu.published"), dateFilterLabel(site, state.published, now), { published: null });
	}
	for (const field of filterFieldsOf(site, state.collection)) {
		const conditions = state.fields[field.name];
		if (!conditions || conditions.length === 0) continue;
		const { [field.name]: _off, ...rest } = state.fields;
		// A blank text or image: "Description blank".
		if (isBlankField(field)) {
			chips.push({
				key: `field:${field.name}`,
				label: t("listMenu.chipBlank", { label: field.label }),
				clear: { fields: rest },
			});
			continue;
		}
		const values = conditions.map((condition) => {
			if (condition.kind !== "is") return t("listMenu.none");
			return field.kind === "select"
				? (field.options?.find((option) => option.value === condition.value)?.label ?? condition.value)
				: (titles.get(condition.value) ?? "…");
		});
		add(`field:${field.name}`, field.label, values.join(", "), { fields: rest });
	}
	return chips;
}
