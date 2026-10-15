/**
 * The schema file as the settings screen edits it: plain data, changed by small pure functions that return a new copy. Key order is part of the file, so every
 * helper keeps it: a renamed key stays where it was, a new property goes where the format puts it (see `FIELD_KEY_ORDER`), and moving is an explicit step.
 */
import { checkField, checkPathPattern, DEFAULT_TITLE_FIELD, defaultCollectionPath, fieldTraits, freshSetFields, IssueList, NAME_PATTERN, RESERVED_METADATA_KEYS, TITLE_ROLE, } from "@monti-cms/core/client";
import { moveWithin } from "../../lib/utils/move-within.js";
export const isObj = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
export const FIELD_KINDS = ["text", "slug", "relation", "select", "media", "conditional", "backlink", "view"];
/** The kinds a conditional field can show (the ones that store one value). */
export const VALUE_KINDS = ["text", "relation", "select", "media"];
/** The order a field's properties are written in: the common ones, then the ones of the kind (the order of the field format in `format.ts` of core). */
export const FIELD_KEY_ORDER = [
    "kind",
    "label",
    "description",
    "required",
    "localized",
    "input",
    "inputOptions",
    "role",
    "fillFromBody",
    "multiline",
    "rows",
    "max",
    "from",
    "to",
    "many",
    "createInline",
    "publishedOnly",
    "allowUnpublished",
    "ordered",
    "view",
    "via",
    "accept",
    "options",
    "defaultValue",
    "discriminant",
    "values",
    "placeholder",
];
export const COLLECTION_KEY_ORDER = [
    "label",
    "kind",
    "icon",
    "path",
    "folders",
    "body",
    "defaultTab",
    "fields",
    "layout",
];
/** `obj` with `key` set (or removed when `value` is `undefined`). A new key goes after the last key before it in `order` that is present, else at the end. */
export function setProp(obj, key, value, order = []) {
    if (value === undefined) {
        const { [key]: _removed, ...rest } = obj;
        return rest;
    }
    if (key in obj)
        return { ...obj, [key]: value };
    const at = order.indexOf(key);
    const entries = Object.entries(obj);
    let index = entries.length;
    if (at !== -1) {
        const before = entries.map(([name]) => order.indexOf(name)).filter((position) => position !== -1 && position < at);
        const anchor = before.length > 0 ? Math.max(...before) : -1;
        const position = anchor === -1 ? -1 : entries.findIndex(([name]) => order.indexOf(name) === anchor);
        index = position + 1;
        // A key that comes later in the order than every present known key goes after the known keys, before any unknown ones.
    }
    entries.splice(index, 0, [key, value]);
    return Object.fromEntries(entries);
}
const FILE_KEY_ORDER = [
    "schemaVersion",
    "collections",
    "migrations",
    "locales",
    "defaultLocale",
    "timeZone",
    "site",
    "admin",
    "seed",
];
/** Where each key of the `site` and `admin` settings is written when it is new. */
const SECTION_KEY_ORDER = {
    site: ["url", "name", "home", "previewPath", "previewLocaleParam", "localePrefix", "aliases"],
    admin: ["path", "locale", "templates", "translations", "messages"],
};
/** The `site` or `admin` settings of the file (empty when it has none). */
export const sectionOf = (file, section) => (isObj(file[section]) ? file[section] : {});
/** `file` with one setting of `site` or `admin` set (or removed when `value` is `undefined`); a section left empty is removed. */
export function setSetting(file, section, key, value) {
    const next = setProp(sectionOf(file, section), key, value, SECTION_KEY_ORDER[section]);
    return setProp(file, section, Object.keys(next).length === 0 ? undefined : next, FILE_KEY_ORDER);
}
/** The settings of `site` and `admin` that differ between the saved file and the draft, in the order of the draft. */
export function settingChanges(base, draft) {
    const changes = [];
    for (const section of ["site", "admin"]) {
        const before = sectionOf(base, section);
        const after = sectionOf(draft, section);
        for (const key of new Set([...Object.keys(after), ...Object.keys(before)])) {
            if (!sameJson(before[key], after[key]))
                changes.push({ path: `${section}.${key}`, from: before[key], to: after[key] });
        }
    }
    return changes;
}
/**
 * How many things differ between the saved file and the draft: each collection that was added, removed or edited, each of the language settings
 * (`locales`, `defaultLocale`, `timeZone`) and each changed `site` or `admin` setting. The number shown as unsaved changes.
 */
export function changeCount(base, draft) {
    const before = collectionsOf(base);
    const after = collectionsOf(draft);
    let count = 0;
    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);
    const sameNames = beforeKeys.length === afterKeys.length && beforeKeys.every((key) => key in after);
    if (sameNames && !sameJson(beforeKeys, afterKeys))
        count += 1;
    for (const name of new Set([...beforeKeys, ...afterKeys])) {
        if (!sameJson(before[name], after[name]))
            count += 1;
    }
    for (const key of ["locales", "defaultLocale", "timeZone"]) {
        if (!sameJson(base[key], draft[key]))
            count += 1;
    }
    return count + settingChanges(base, draft).length;
}
/** `record` with the key `from` named `to`, in the same place. */
export function renameKey(record, from, to) {
    return Object.fromEntries(Object.entries(record).map(([key, value]) => [key === from ? to : key, value]));
}
/** `record` with `key` moved by `delta` places (negative: up). */
export function moveKey(record, key, delta) {
    const entries = Object.entries(record);
    const from = entries.findIndex(([name]) => name === key);
    return from === -1 ? record : Object.fromEntries(moveWithin(entries, from, from + delta));
}
/** `list` with the item at `index` moved by `delta` places (negative: up). */
export function moveItem(list, index, delta) {
    return moveWithin(list, index, index + delta);
}
/** Whether two JSON values are the same, key order included. */
export function sameJson(a, b) {
    if (Array.isArray(a))
        return Array.isArray(b) && a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
    if (isObj(a)) {
        if (!isObj(b))
            return false;
        const left = Object.keys(a).filter((key) => a[key] !== undefined);
        const right = Object.keys(b).filter((key) => b[key] !== undefined);
        return left.length === right.length && left.every((key, i) => key === right[i] && sameJson(a[key], b[key]));
    }
    return a === b;
}
/** Why `name` cannot be used among `taken` names, or `null`. */
export function nameProblem(name, taken) {
    if (name.trim() === "")
        return "empty";
    if (!NAME_PATTERN.test(name))
        return "pattern";
    if (RESERVED_METADATA_KEYS.includes(name))
        return "reserved";
    if (taken.includes(name))
        return "taken";
    return null;
}
// ----- the file -----
export const collectionsOf = (file) => isObj(file.collections) ? file.collections : {};
export const fieldsOf = (collection) => isObj(collection.fields) ? collection.fields : {};
export function setCollection(file, name, update) {
    const collections = collectionsOf(file);
    const current = collections[name];
    if (!current)
        return file;
    return { ...file, collections: { ...collections, [name]: update(current) } };
}
/** The public address a new document collection starts with, from its name. */
export const defaultPath = (id) => (id === "" ? "" : defaultCollectionPath(id));
/** The identifier a display name suggests: lowercase ASCII words joined with `-` ("Blog posts" -> "blog-posts"). Empty when the name has no ASCII letters or digits (Korean). */
export const idFromName = (name) => name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
/** Why a public address cannot be used (the file wants a `/` first and `:slug` once), or `null`. Empty is fine: the entries have no public page. */
export function pathProblem(path) {
    if (path.trim() === "")
        return null;
    return checkPathPattern(path)?.code ?? null;
}
/** A new collection: every collection needs a title, and a slug is what the public address is made from, so both start in place. */
export function addCollection(file, name, kind, path, label) {
    let collection = {
        label: label?.trim() || name.charAt(0).toUpperCase() + name.slice(1),
        kind,
        fields: {
            title: { kind: "text", label: "Title", required: true, role: TITLE_ROLE },
            slug: { kind: "slug", label: "Slug", required: true, from: "title" },
        },
    };
    if (path && path.trim() !== "")
        collection = setProp(collection, "path", path, COLLECTION_KEY_ORDER);
    return { ...file, collections: { ...collectionsOf(file), [name]: collection } };
}
export function removeCollection(file, name) {
    const { [name]: _removed, ...rest } = collectionsOf(file);
    return { ...file, collections: rest };
}
/** `file` with the collection `name` moved by `delta` places in `collections` (negative: up). */
export function moveCollection(file, name, delta) {
    return { ...file, collections: moveKey(collectionsOf(file), name, delta) };
}
/** `file` with its `collections` keys arranged in `newOrder`. */
export function reorderCollections(file, newOrder) {
    const collections = collectionsOf(file);
    const reordered = {};
    for (const name of newOrder) {
        if (name in collections)
            reordered[name] = collections[name];
    }
    for (const [name, col] of Object.entries(collections)) {
        if (!reordered[name])
            reordered[name] = col;
    }
    return { ...file, collections: reordered };
}
// ----- fields -----
/** Every name in `fields` or inside a conditional field, for the uniqueness of a new name (the stored values share one namespace). */
export function allFieldNames(collection) {
    const names = [];
    for (const [name, field] of Object.entries(fieldsOf(collection))) {
        names.push(name);
        if (field.kind === "conditional" && isObj(field.values)) {
            for (const branch of Object.values(field.values))
                if (isObj(branch))
                    names.push(...Object.keys(branch));
        }
    }
    return names;
}
/** The properties every kind of field can have, so a change of kind keeps what still applies. */
const BASE_KEYS = ["label", "description", "required", "localized", "input", "inputOptions", "role"];
const NO_VALUE_KEYS = ["required", "localized", "input", "inputOptions", "role"];
/** A field of `kind` with the properties it needs. */
export function newField(kind, label, collections = []) {
    switch (kind) {
        case "text":
            return { kind, label };
        case "slug":
            return { kind, label, from: "title" };
        case "relation":
            return { kind, label, to: collections[0] ?? "" };
        case "select":
            return { kind, label, options: { first: "First" }, defaultValue: "first" };
        case "media":
            return { kind, label };
        case "conditional":
            return {
                kind,
                label,
                discriminant: { kind: "select", label, options: { a: "A", b: "B" }, defaultValue: "a" },
                values: {},
            };
        case "backlink":
            return { kind, label, from: collections[0] ?? "", via: "" };
        case "view":
            return { kind, view: "", label };
    }
}
/** `field` as another kind: the common properties stay (the ones the new kind can have), the rest is the new kind's defaults. */
export function withKind(field, kind, collections) {
    const fresh = newField(kind, typeof field.label === "string" ? field.label : "", collections);
    const kept = Object.fromEntries(Object.entries(field).filter(([key]) => BASE_KEYS.includes(key) && !(!fieldTraits[kind].entersValue && NO_VALUE_KEYS.includes(key))));
    let result = fresh;
    for (const [key, value] of Object.entries(kept)) {
        if (key === "kind")
            continue;
        result = setProp(result, key, value, FIELD_KEY_ORDER);
    }
    return result;
}
/** Records `from -> to`; a rename of a name that was renamed before extends it, and one that returns to the first name cancels it. */
export function recordRename(renames, next) {
    const same = (a, b) => a.kind === b.kind &&
        a.collection === b.collection &&
        (a.kind !== "option" || (b.kind === "option" && a.field === b.field));
    const earlier = renames.find((item) => same(item, next) && item.to === next.from);
    const rest = renames.filter((item) => item !== earlier);
    if (!earlier)
        return [...rest, next];
    if (earlier.from === next.to)
        return rest;
    return [...rest, { ...next, from: earlier.from }];
}
/** Replaces `from` with `to` (or removes it when `to` is `null`) in the names a collection lists besides its fields: layout groups, a slug's source. */
function rewriteReferences(collection, from, to) {
    let result = collection;
    if (Array.isArray(result.layout)) {
        const layout = result.layout.map((group) => ({
            ...group,
            fields: (Array.isArray(group.fields) ? group.fields : []).flatMap((name) => name === from ? (to ? [to] : []) : [name]),
        }));
        result = { ...result, layout };
    }
    const fields = fieldsOf(result);
    const touched = Object.entries(fields).map(([name, field]) => field.kind === "slug" && field.from === from
        ? [name, to ? { ...field, from: to } : (({ from: _from, ...rest }) => rest)(field)]
        : [name, field]);
    return { ...result, fields: Object.fromEntries(touched) };
}
function updateFields(collection, place, update) {
    const fields = fieldsOf(collection);
    if (!place.branch)
        return { ...collection, fields: update(fields) };
    const holder = fields[place.branch.field];
    if (!holder || !isObj(holder.values))
        return collection;
    const values = holder.values;
    const branch = values[place.branch.option] ?? {};
    return {
        ...collection,
        fields: {
            ...fields,
            [place.branch.field]: { ...holder, values: { ...values, [place.branch.option]: update(branch) } },
        },
    };
}
export function addField(collection, place, name, field) {
    return updateFields(collection, place, (fields) => ({ ...fields, [name]: field }));
}
/** The fields of a plugin's field set added after the others, under names the collection does not use yet. */
export function addFieldSet(collection, set) {
    const added = freshSetFields(set, fieldsOf(collection));
    return updateFields(collection, {}, (fields) => ({ ...fields, ...added }));
}
export function setField(collection, place, name, update) {
    return updateFields(collection, place, (fields) => {
        const current = fields[name];
        return current ? { ...fields, [name]: update(current) } : fields;
    });
}
export function removeField(collection, place, name) {
    const removed = updateFields(collection, place, (fields) => {
        const { [name]: _removed, ...rest } = fields;
        return rest;
    });
    return rewriteReferences(removed, name, null);
}
export function moveField(collection, place, name, delta) {
    return updateFields(collection, place, (fields) => moveKey(fields, name, delta));
}
/** Puts `name` where `over` is (a field dropped on another one of the same list); any other name leaves the list as it is. */
export function reorderField(collection, place, name, over) {
    return updateFields(collection, place, (fields) => {
        const keys = Object.keys(fields);
        const from = keys.indexOf(name);
        const to = keys.indexOf(over);
        return from < 0 || to < 0 || from === to ? fields : moveKey(fields, name, to - from);
    });
}
/**
 * The name of the title field of a collection: the field with the `title` role, else the one named `title` (the file only has it at the top level of `fields`).
 * `undefined` when there is none.
 */
export function titleFieldName(collection) {
    const fields = fieldsOf(collection);
    const byRole = Object.keys(fields).find((name) => fields[name]?.role === TITLE_ROLE);
    if (byRole)
        return byRole;
    return fields[DEFAULT_TITLE_FIELD]?.kind === "text" ? DEFAULT_TITLE_FIELD : undefined;
}
/** Makes `name` the title field: it gets the `title` role, and the field that had it loses it. */
export function setTitleField(collection, name) {
    const fields = Object.fromEntries(Object.entries(fieldsOf(collection)).map(([key, field]) => [
        key,
        key === name
            ? setProp(field, "role", TITLE_ROLE, FIELD_KEY_ORDER)
            : field.role === TITLE_ROLE
                ? setProp(field, "role", undefined)
                : field,
    ]));
    return { ...collection, fields };
}
/**
 * Renames a field. The title field keeps being the title field under its new name: a title found by its name (the default) gets the `title` role, which is
 * what names it from then on.
 */
export function renameField(collection, place, from, to) {
    const renamedTitle = !place.branch && titleFieldName(collection) === from && fieldsOf(collection)[from]?.role !== TITLE_ROLE;
    const renamed = rewriteReferences(updateFields(collection, place, (fields) => renameKey(fields, from, to)), from, to);
    return renamedTitle
        ? setField(renamed, place, to, (field) => setProp(field, "role", TITLE_ROLE, FIELD_KEY_ORDER))
        : renamed;
}
// ----- select options -----
/** The options of a select field, or of the discriminant of a conditional field. */
export function optionsOf(field) {
    const select = field.kind === "conditional" && isObj(field.discriminant) ? field.discriminant : field;
    return isObj(select.options) ? select.options : {};
}
function updateSelect(field, update) {
    if (field.kind === "conditional" && isObj(field.discriminant))
        return { ...field, discriminant: update(field.discriminant) };
    return update(field);
}
export function addOption(field, value, label) {
    return updateSelect(field, (select) => {
        const options = { ...optionsOf(select), [value]: label };
        const result = setProp(select, "options", options, FIELD_KEY_ORDER);
        return typeof select.defaultValue === "string" && select.defaultValue in options
            ? result
            : setProp(result, "defaultValue", value, FIELD_KEY_ORDER);
    });
}
export function setOptionLabel(field, value, label) {
    return updateSelect(field, (select) => ({ ...select, options: { ...optionsOf(select), [value]: label } }));
}
export function renameOption(field, from, to) {
    const renamed = updateSelect(field, (select) => ({
        ...select,
        options: renameKey(optionsOf(select), from, to),
        ...(select.defaultValue === from ? { defaultValue: to } : {}),
    }));
    if (renamed.kind === "conditional" && isObj(renamed.values))
        return { ...renamed, values: renameKey(renamed.values, from, to) };
    return renamed;
}
export function removeOption(field, value) {
    const trimmed = updateSelect(field, (select) => {
        const { [value]: _removed, ...options } = optionsOf(select);
        const first = Object.keys(options)[0];
        return {
            ...select,
            options,
            ...(select.defaultValue === value && first !== undefined ? { defaultValue: first } : {}),
        };
    });
    if (trimmed.kind === "conditional" && isObj(trimmed.values)) {
        const { [value]: _branch, ...values } = trimmed.values;
        return { ...trimmed, values };
    }
    return trimmed;
}
export function moveOption(field, value, delta) {
    return updateSelect(field, (select) => ({ ...select, options: moveKey(optionsOf(select), value, delta) }));
}
export function setDefaultOption(field, value) {
    return updateSelect(field, (select) => ({ ...select, defaultValue: value }));
}
/** Whether a collection has a body (the file leaves it out for a document, which has one). */
export const hasBody = (collection) => {
    const { body } = collection;
    if (typeof body === "boolean")
        return body;
    if (isObj(body))
        return true;
    return collection.kind !== "item";
};
export const allowedOf = (collection) => (isObj(collection.body) ? collection.body : {});
/** The collection with its body written back: left out when it is the default of the kind and nothing is limited, a flag, or the object form. */
export function withBody(collection, enabled, allowed) {
    const limits = Object.fromEntries(Object.entries(allowed).filter(([, list]) => Array.isArray(list)));
    const defaultBody = collection.kind !== "item";
    const body = !enabled ? false : Object.keys(limits).length > 0 ? limits : defaultBody ? undefined : true;
    // The object form wins over a flag already in the file only when something is limited; an explicit `true` stays as written.
    if (body === undefined && collection.body === true)
        return collection;
    return setProp(collection, "body", body, COLLECTION_KEY_ORDER);
}
export function withLayout(collection, layout) {
    return setProp(collection, "layout", layout.length > 0 ? layout : undefined, COLLECTION_KEY_ORDER);
}
export const localesOf = (file) => (Array.isArray(file.locales) ? file.locales : []);
// ----- what a field needs -----
/** The field `name` at `place`, or `undefined`. */
export function fieldAt(collection, place, name) {
    if (!place.branch)
        return fieldsOf(collection)[name];
    const holder = fieldsOf(collection)[place.branch.field];
    const values = holder && isObj(holder.values) ? holder.values : {};
    return values[place.branch.option]?.[name];
}
/** The kinds that cannot be added with a name alone: they open their settings first. */
export const KINDS_WITH_SETTINGS = [
    "conditional",
    "relation",
    "select",
    "slug",
    "backlink",
    "view",
];
/** The rule codes of core that mean the form still lacks a setting, and the problem the form names for each. */
const PROBLEM_OF_CODE = {
    "options-empty": "options",
    "option-label": "optionLabel",
    "branches-empty": "branches",
    "unknown-collection": "target",
    "slug-source": "slugFrom",
    "backlink-incomplete": "backlink",
    "view-name": "view",
};
/**
 * What is still missing from `field` before it can be added (the settings its kind requires), in the order the form shows them. Empty: it is complete. The rules are
 * core's (`checkField`, the ones `defineSite` applies to the saved file); the form only turns the codes into the names its messages use.
 */
export function fieldProblems(field, collection, collectionNames) {
    const list = new IssueList();
    checkField(list, "", "field", field, {
        collectionNames,
        fields: fieldsOf(collection),
        body: hasBody(collection),
    });
    const problems = list.issues.flatMap((issue) => {
        const problem = PROBLEM_OF_CODE[issue.code];
        return problem === undefined ? [] : [problem === "target" && field.kind === "backlink" ? "backlink" : problem];
    });
    // A slug is made from a text field; core lets the address stand alone, the form asks for the source.
    if (field.kind === "slug" && typeof field.from !== "string" && !problems.includes("slugFrom"))
        problems.push("slugFrom");
    return [...new Set(problems)];
}
/**
 * Why a field cannot be deleted, or `null`. The title field is what names every entry; the slug field cannot go while the public address is made from `:slug`.
 * Only top-level fields: the file does not take either of them inside a conditional field.
 */
export function removeBlock(collection, place, name) {
    if (place.branch)
        return null;
    if (titleFieldName(collection) === name)
        return "title";
    const fields = fieldsOf(collection);
    const slugName = Object.keys(fields).find((key) => fields[key]?.kind === "slug");
    if (slugName === name && typeof collection.path === "string" && collection.path.includes(":slug"))
        return "slug";
    return null;
}
