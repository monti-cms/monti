import type { Site } from "@monti-cms/core/site";
import type { DateFilter } from "./list-dates";
import { filterFieldsOf, isBlankField } from "./list-filter-fields";
import { shortDay } from "./list-row-dates";
import { LIST_STATUS_ORDER, type ListState } from "./list-state";
import { screensMessages } from "./messages";
import { statusLabels } from "./shared/entry-status";

/** One filter that is on, as the chip under the page title says it, and the change that takes it off. */
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
 * The chips of the filters that are on, in the order the columns' menus list them (the status, the language, the dates, then the fields). `titles` names the
 * items of a relation by id (`id` → title), which only the server knows; an id it does not know yet shows as "…" until it does.
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
	if (state.statuses.length > 0) {
		const names = { ...statusLabels(site), editing: t("filter.editing") };
		add(
			"status",
			t("column.status"),
			LIST_STATUS_ORDER.filter((status) => state.statuses.includes(status))
				.map((status) => names[status])
				.join(", "),
			{ statuses: [] },
		);
	}
	if (state.locales.length > 0) {
		add("locale", t("column.locale"), state.locales.map((locale) => site.localeLabel(locale)).join(", "), {
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
	for (const key of ["updated", "published", "created"] as const) {
		const filter = state[key];
		if (filter) add(key, t(`listMenu.${key}`), dateFilterLabel(site, filter, now), { [key]: null });
	}
	for (const field of filterFieldsOf(site, state.collection)) {
		const conditions = state.fields[field.name];
		if (!conditions || conditions.length === 0) continue;
		const { [field.name]: _off, ...rest } = state.fields;
		// A text or an image is only ever looked for when it is empty: "Summary empty".
		if (isBlankField(field)) {
			chips.push({
				key: `field:${field.name}`,
				label: t("listMenu.chipEmpty", { label: field.label }),
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
