import { checkTabName } from "../config/check/fields.js";
import { IssueList, pathOf } from "../config/check/issue.js";
import { findTitleField } from "./walk.js";
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
export const DEFAULT_TAB = "";
/** The key of `contributes` in which a plugin says where its fields sit in the panel. */
export const LAYOUT_CONTRIBUTION = "layout";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** What the plugins place, read from their `contributes` (a plugin of the browser's snapshot has it as data). */
export function placementsOf(plugins) {
    return plugins.flatMap((plugin) => {
        const placed = plugin.contributes?.[LAYOUT_CONTRIBUTION];
        if (!Array.isArray(placed))
            return [];
        return placed
            .filter(isRecord)
            .map((placement) => ({ ...placement, plugin: plugin.name }));
    });
}
/** The problems of what plugins place: a tab name the panel can show, and role and view names that are text. */
export function checkPlacements(plugins) {
    const list = new IssueList();
    for (const plugin of plugins) {
        const placed = plugin.contributes?.[LAYOUT_CONTRIBUTION];
        if (placed === undefined)
            continue;
        const base = pathOf("plugins", plugin.name, "contributes", LAYOUT_CONTRIBUTION);
        if (!Array.isArray(placed)) {
            list.add(base, "type", "must be a list of placements");
            continue;
        }
        for (const [index, placement] of placed.entries()) {
            const at = pathOf(base, index);
            if (!isRecord(placement) || typeof placement.tab !== "string") {
                list.add(pathOf(at, "tab"), "required", "needs a tab name");
                continue;
            }
            checkTabName(list, pathOf(at, "tab"), placement.tab);
            for (const key of ["roles", "views"]) {
                const names = placement[key];
                if (names !== undefined && (!Array.isArray(names) || names.some((name) => typeof name !== "string"))) {
                    list.add(pathOf(at, key), "type", "must be a list of names");
                }
            }
        }
    }
    return list.issues;
}
/**
 * Whether the panel draws a field. The title of a document is the heading of the edit screen, not a property, so the panel leaves it out; every other field is drawn,
 * and so is the title of an item (the record panel has no other place for it).
 */
export function isPanelField(schema, name) {
    if (!Object.hasOwn(schema.fields, name))
        return false;
    return schema.kind !== "document" || findTitleField(schema)?.name !== name;
}
/** The fields a placement finds in a collection, in the order of the collection. */
function membersOf(schema, placement) {
    return Object.entries(schema.fields)
        .filter(([, field]) => {
        const role = field.role;
        if (role !== undefined && placement.roles?.includes(role))
            return true;
        return field.kind === "view" && placement.views?.includes(field.view) === true;
    })
        .map(([name]) => name);
}
/** The groups of the panel, tab by tab in the order they are drawn. Empty groups stay (a tab or a group a person added exists before it has a field). */
export function panelGroupsOf(schema, placements = []) {
    const drawn = Object.keys(schema.fields).filter((name) => isPanelField(schema, name));
    const placed = [];
    const locked = new Set();
    for (const placement of placements) {
        const fields = membersOf(schema, placement).filter((name) => drawn.includes(name) && !locked.has(name));
        for (const name of fields)
            locked.add(name);
        if (fields.length > 0)
            placed.push({ placement, fields });
    }
    const taken = new Set();
    const groups = [];
    for (const group of schema.layout ?? []) {
        const fields = group.fields.filter((name) => {
            if (!drawn.includes(name) || locked.has(name) || taken.has(name))
                return false;
            taken.add(name);
            return true;
        });
        groups.push({
            ...(group.group ? { group: group.group } : {}),
            ...(group.group && group.collapsed === true ? { collapsed: true } : {}),
            fields,
            tab: group.tab ? group.tab : DEFAULT_TAB,
        });
    }
    const rest = drawn.filter((name) => !locked.has(name) && !taken.has(name));
    if (rest.length > 0)
        groups.push({ fields: rest, tab: DEFAULT_TAB });
    for (const { placement, fields } of placed) {
        groups.push({ group: placement.tab, fields, tab: placement.tab, placedBy: placement.plugin });
    }
    return groups;
}
/** The tabs of the panel: the default one first, then the others in the order their groups first appear. */
export const panelTabsOf = (groups) => [
    ...new Set([DEFAULT_TAB, ...groups.map((group) => group.tab)]),
];
/**
 * The tab that draws a field. A field of a conditional field's branch is drawn with that field. The default tab for a name the panel does not draw (a publish problem
 * on the title, say).
 */
export function panelTabOf(schema, groups, path) {
    const top = Object.hasOwn(schema.fields, path)
        ? path
        : Object.entries(schema.fields).find(([, field]) => field.kind === "conditional" && Object.values(field.values).some((branch) => branch && path in branch))?.[0];
    return (top === undefined ? undefined : groups.find((group) => group.fields.includes(top))?.tab) ?? DEFAULT_TAB;
}
/** The panel of the collections of one site: its plugins' placements applied to `schemaOf`. */
export function createPanel(schemas, plugins) {
    const placements = placementsOf(plugins);
    return {
        /** The groups of a collection's panel, tab by tab (see {@link panelGroupsOf}). */
        panelGroupsOf: (collection) => panelGroupsOf(schemas.schemaOf(collection), placements),
        /** The tabs of a collection's panel, the default one first. */
        panelTabsOf: (collection) => panelTabsOf(panelGroupsOf(schemas.schemaOf(collection), placements)),
        /** The tab that draws a field (a path into the collection's fields). */
        panelTabOf: (collection, path) => {
            const schema = schemas.schemaOf(collection);
            return panelTabOf(schema, panelGroupsOf(schema, placements), path);
        },
    };
}
