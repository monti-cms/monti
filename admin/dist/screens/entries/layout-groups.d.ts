import type { LayoutGroup, SchemaCollection, Site } from "@monti-cms/core/client";
/** Default tab (groups and fields without a `tab`). */
export declare const defaultTab: (site: Pick<Site, "createTranslator">) => string;
export declare const tabOfGroup: (site: Site, group: LayoutGroup) => string;
/**
 * Groups to render in the properties panel. Layout (`layout`) groups come in order, and fields not in the layout go after the last group in declaration order.
 *
 * A layout group's `tab` takes priority; if the group has no `tab`, the field's `tab` is used. Fields with their own `tab` (e.g. field groups supplied by an extension) are
 * gathered into one group per tab and placed last. The group's name is the tab name (shown as the group title on screens without tabs).
 */
export declare function layoutGroupsOf(site: Site, collection: SchemaCollection): LayoutGroup[];
/** Tab names (default tab first, the rest in order of first appearance in groups). */
export declare function tabsOf(site: Site, collection: SchemaCollection): string[];
/** Tab that holds the field. A field attached to a conditional field uses that field's tab. When jumping to a publish problem, that tab is opened first. */
export declare function tabOf(site: Site, collection: SchemaCollection, path: string): string;
