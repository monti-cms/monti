import { type ConfigIssue } from "../config/check/issue.js";
import type { PluginContributions } from "../plugin/define.js";
import type { CollectionSchema, LayoutGroup } from "./collection.js";
/**
 * The properties panel of a collection: which fields it draws, in which groups, in which tabs. One pure algorithm that everything reads: the edit screen's panel, the record
 * panel of an item, the settings screen's tree of fields (and its live preview), and the checks of the site config. The tree is derived from the groups this returns,
 * and written back as a `layout`, so the tree, the schema and the panel cannot say different things.
 *
 * The groups come from three places, in this order: the `layout` of the collection (the site's own groups, in order), the fields the layout does not list (one run in the
 * default tab), and the groups plugins place (`contributes.layout` of a plugin: its fields, found by role or view name, in a tab of its own). A field a plugin places
 * is drawn there whatever the layout says; the settings screen shows it locked.
 */
/**
 * The id of the tab that holds the groups with no `tab`. A tab a person names has at least one character, so none equals this id; the screens translate it to show it
 * and never use the translation as the tab's identity.
 */
export declare const DEFAULT_TAB = "";
/** The key of `contributes` in which a plugin says where its fields sit in the panel. */
export declare const LAYOUT_CONTRIBUTION = "layout";
/**
 * Where a plugin places its fields: a tab of its own, with the fields that have one of these roles or are one of these views. A collection without such a field gets no
 * tab. This is data (no functions), so it reaches the browser with the rest of `contributes`.
 */
export interface PluginPlacement {
    /** The tab (1 to 20 characters). Its name is also the title of the group when the panel has no tabs. */
    readonly tab: string;
    /** Fields with one of these roles (`FieldRole`) are placed. */
    readonly roles?: readonly string[];
    /** View fields (`fields.view({ view })`) with one of these names are placed. */
    readonly views?: readonly string[];
}
/** A placement and the plugin that made it. */
export interface NamedPlacement extends PluginPlacement {
    readonly plugin: string;
}
/** What the grouping reads of a collection. The settings screen's draft has the same shape. */
export type PanelSource = Pick<CollectionSchema, "kind" | "fields"> & {
    readonly layout?: readonly LayoutGroup[];
};
/** One group of the panel. */
export interface PanelGroup {
    /** Title; none: the fields are drawn continuously. */
    readonly group?: string;
    readonly fields: readonly string[];
    /** Collapsed at first. */
    readonly collapsed?: boolean;
    /** The tab it is drawn in ({@link DEFAULT_TAB} for the first one). */
    readonly tab: string;
    /** The plugin that placed these fields; they are not the site's to move. */
    readonly placedBy?: string;
}
/** What the plugins place, read from their `contributes` (a plugin of the browser's snapshot has it as data). */
export declare function placementsOf(plugins: readonly {
    readonly name: string;
    readonly contributes?: PluginContributions;
}[]): NamedPlacement[];
/** The problems of what plugins place: a tab name the panel can show, and role and view names that are text. */
export declare function checkPlacements(plugins: readonly {
    readonly name: string;
    readonly contributes?: PluginContributions;
}[]): ConfigIssue[];
/**
 * Whether the panel draws a field. The title of a document is the heading of the edit screen, not a property, so the panel leaves it out; every other field is drawn,
 * and so is the title of an item (the record panel has no other place for it).
 */
export declare function isPanelField(schema: Pick<CollectionSchema, "kind" | "fields">, name: string): boolean;
/** The groups of the panel, tab by tab in the order they are drawn. Empty groups stay (a tab or a group a person added exists before it has a field). */
export declare function panelGroupsOf(schema: PanelSource, placements?: readonly NamedPlacement[]): PanelGroup[];
/** The tabs of the panel: the default one first, then the others in the order their groups first appear. */
export declare const panelTabsOf: (groups: readonly PanelGroup[]) => string[];
/**
 * The tab that draws a field. A field of a conditional field's branch is drawn with that field. The default tab for a name the panel does not draw (a publish problem
 * on the title, say).
 */
export declare function panelTabOf(schema: Pick<CollectionSchema, "fields">, groups: readonly PanelGroup[], path: string): string;
/** The panel of the collections of one site: its plugins' placements applied to `schemaOf`. */
export declare function createPanel(schemas: {
    schemaOf(collection: string): CollectionSchema;
}, plugins: readonly {
    readonly name: string;
    readonly contributes?: PluginContributions;
}[]): {
    /** The groups of a collection's panel, tab by tab (see {@link panelGroupsOf}). */
    panelGroupsOf: (collection: string) => PanelGroup[];
    /** The tabs of a collection's panel, the default one first. */
    panelTabsOf: (collection: string) => string[];
    /** The tab that draws a field (a path into the collection's fields). */
    panelTabOf: (collection: string, path: string) => string;
};
/** The panel of one site (see {@link createPanel}). */
export type SitePanel = ReturnType<typeof createPanel>;
