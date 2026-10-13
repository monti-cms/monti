import type { LayoutGroup, SchemaCollection, Site } from "@monti-cms/core/client";
import { entriesMessages } from "./messages";

/** Default tab (groups and fields without a `tab`). */
export const defaultTab = (site: Pick<Site, "createTranslator">) =>
	site.createTranslator(entriesMessages)("tab.default");

export const tabOfGroup = (site: Site, group: LayoutGroup) => group.tab ?? defaultTab(site);

/**
 * Groups to render in the properties panel. Layout (`layout`) groups come in order, and fields not in the layout go after the last group in declaration order.
 *
 * A layout group's `tab` takes priority; if the group has no `tab`, the field's `tab` is used. Fields with their own `tab` (e.g. field groups supplied by an extension) are
 * gathered into one group per tab and placed last. The group's name is the tab name (shown as the group title on screens without tabs).
 */
export const layoutGroupsOf = (site: Site, collection: SchemaCollection): LayoutGroup[] =>
	layoutGroupsOfSchema(site.schemaOf(collection));

/** What the grouping reads of a collection: the fields (for their own `tab`) and the layout. A draft of the settings screen has the same shape. */
export interface GroupingSchema {
	readonly fields: Readonly<Record<string, { readonly tab?: string }>>;
	readonly layout?: readonly LayoutGroup[];
}

/** Whether the panel draws a field: a hidden field is not (a conditional field is, its hidden option applies to what it shows). */
export const isDrawnField = (field: { readonly kind: string; readonly hidden?: boolean }): boolean =>
	field.kind === "conditional" || field.hidden !== true;

/** `layoutGroupsOf` for any schema with these parts, so the settings screen's preview groups exactly like the panel. */
export function layoutGroupsOfSchema(schema: GroupingSchema): LayoutGroup[] {
	const groups: LayoutGroup[] = [];
	const byTab = new Map<string, string[]>();
	const moveToTab = (name: string, tab: string) => byTab.set(tab, [...(byTab.get(tab) ?? []), name]);
	const ownTab = (name: string) => schema.fields[name]?.tab;

	for (const group of schema.layout ?? []) {
		if (group.tab !== undefined) {
			groups.push(group);
			continue;
		}
		const stay = group.fields.filter((name) => ownTab(name) === undefined);
		for (const name of group.fields) {
			const tab = ownTab(name);
			if (tab !== undefined) moveToTab(name, tab);
		}
		if (stay.length > 0) groups.push(stay.length === group.fields.length ? group : { ...group, fields: stay });
	}

	const placed = new Set((schema.layout ?? []).flatMap((group) => group.fields));
	const rest = Object.keys(schema.fields).filter((name) => !placed.has(name));
	const restStay = rest.filter((name) => ownTab(name) === undefined);
	if (restStay.length > 0) groups.push({ fields: restStay });
	for (const name of rest) {
		const tab = ownTab(name);
		if (tab !== undefined) moveToTab(name, tab);
	}
	for (const [tab, fields] of byTab) groups.push({ group: tab, tab, fields });
	return groups;
}

/** Tab names (default tab first, the rest in order of first appearance in groups). */
export function tabsOf(site: Site, collection: SchemaCollection): string[] {
	return [...new Set([defaultTab(site), ...layoutGroupsOf(site, collection).map((group) => tabOfGroup(site, group))])];
}

/** Tab that holds the field. A field attached to a conditional field uses that field's tab. When jumping to a publish problem, that tab is opened first. */
export function tabOf(site: Site, collection: SchemaCollection, path: string): string {
	const schema = site.schemaOf(collection);
	const top = Object.hasOwn(schema.fields, path)
		? path
		: Object.entries(schema.fields).find(
				([, field]) =>
					field.kind === "conditional" && Object.values(field.values).some((group) => group && path in group),
			)?.[0];
	const group =
		top === undefined ? undefined : layoutGroupsOf(site, collection).find((item) => item.fields.includes(top));
	return group ? tabOfGroup(site, group) : defaultTab(site);
}
