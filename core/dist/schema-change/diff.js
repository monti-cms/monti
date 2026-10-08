import { isDeepStrictEqual } from "node:util";
import { valueFieldsOf } from "../schema/walk.js";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const stringList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : undefined;
function signatureOf(field) {
    if (field.kind === "relation")
        return `relation:${field.to}${field.many ? "[]" : ""}`;
    if (field.kind === "media")
        return `media:${field.accept ?? "image"}`;
    return field.kind;
}
function fieldShape(stored) {
    const { field } = stored;
    const localized = "localized" in field ? field.localized : undefined;
    return {
        name: stored.name,
        kind: field.kind,
        signature: signatureOf(field),
        required: "required" in field && field.required === true,
        localized: localized === true ? "localized" : localized === "inherit" ? "inherit" : "shared",
        options: field.kind === "select" ? Object.keys(field.options) : [],
        branch: stored.when ? { field: stored.when.field, value: stored.when.value } : null,
    };
}
/** The body of a collection: with the file's object form of `body`, or the normalized `body` flag and `allowed` of the site config. */
function bodyShape(collection) {
    const { body } = collection;
    const written = isRecord(body) ? body : isRecord(collection.allowed) ? collection.allowed : undefined;
    const enabled = typeof body === "boolean" ? body : written !== undefined ? true : collection.kind === "document";
    const blocks = stringList(written?.blocks);
    const marks = stringList(written?.marks);
    const headings = Array.isArray(written?.headings)
        ? written.headings.filter((item) => typeof item === "number")
        : undefined;
    return {
        enabled,
        allowed: { ...(blocks && { blocks }), ...(marks && { marks }), ...(headings && { headings }) },
    };
}
function collectionShape(value) {
    const collection = isRecord(value) ? value : {};
    const fields = isRecord(collection.fields) ? collection.fields : {};
    const { enabled, allowed } = bodyShape(collection);
    return {
        kind: typeof collection.kind === "string" ? collection.kind : "document",
        body: enabled,
        allowed,
        fields: new Map(valueFieldsOf({ fields }).map((stored) => [stored.name, fieldShape(stored)])),
        raw: fields,
    };
}
/** Whether `after` allows less than `before` in some respect: a list that did not exist, or lacks something `before` had. */
function narrowed(before, after) {
    for (const key of ["blocks", "marks", "headings"]) {
        const next = after[key];
        const was = before[key];
        if (next === undefined)
            continue;
        if (was === undefined || was.some((item) => !next.includes(item)))
            return true;
    }
    return false;
}
const byField = (transforms, op, collection) => transforms.filter((item) => item.op === op && item.collection === collection);
/**
 * What changed between two schemas: collections, stored fields and select options added, removed or renamed, and fields whose type, required flag, language
 * handling or conditional branch changed, locales added or removed, and the allowed blocks, marks and heading levels of a body. Pure and read-only: nothing here
 * looks at stored entries (that is `checkSchemaChange`).
 *
 * Labels, help text, layout, list columns and the like are not data changes and are not listed. Collection and field names are stored values, so a rename is
 * not visible in two schemas: it shows as a removal and an addition (`renameHints` points out pairs that look alike). A `renameField` or `mapOption`
 * transform in `options.transforms` says it is a rename and turns the pair into one `field_renamed` or `option_renamed` change; any change a transform handles has its `handledBy`.
 */
export function diffSchema(oldSchema, newSchema, options = {}) {
    const transforms = options.transforms ?? [];
    const changes = [];
    const renameHints = [];
    const oldCodes = oldSchema.locales.map((locale) => locale.code);
    const newCodes = newSchema.locales.map((locale) => locale.code);
    for (const locale of newCodes)
        if (!oldCodes.includes(locale))
            changes.push({ kind: "locale_added", locale });
    for (const locale of oldCodes)
        if (!newCodes.includes(locale))
            changes.push({ kind: "locale_removed", locale });
    if (oldSchema.defaultLocale !== undefined && newSchema.defaultLocale !== undefined) {
        if (oldSchema.defaultLocale !== newSchema.defaultLocale) {
            changes.push({ kind: "default_locale_changed", from: oldSchema.defaultLocale, to: newSchema.defaultLocale });
        }
    }
    const oldCollections = new Map(Object.entries(oldSchema.collections).map(([n, c]) => [n, collectionShape(c)]));
    const newCollections = new Map(Object.entries(newSchema.collections).map(([n, c]) => [n, collectionShape(c)]));
    const removedCollections = [...oldCollections.keys()].filter((name) => !newCollections.has(name));
    const addedCollections = [...newCollections.keys()].filter((name) => !oldCollections.has(name));
    const matchedAdded = new Set();
    for (const from of removedCollections) {
        const was = oldCollections.get(from);
        const to = addedCollections.find((name) => !matchedAdded.has(name) &&
            was?.kind === newCollections.get(name)?.kind &&
            isDeepStrictEqual(was?.raw, newCollections.get(name)?.raw));
        if (to !== undefined) {
            matchedAdded.add(to);
            renameHints.push({ scope: "collection", from, to });
        }
    }
    for (const collection of removedCollections)
        changes.push({ kind: "collection_removed", collection });
    for (const collection of addedCollections)
        changes.push({ kind: "collection_added", collection });
    for (const [collection, before] of oldCollections) {
        const after = newCollections.get(collection);
        if (!after)
            continue;
        if (before.kind !== after.kind) {
            changes.push({ kind: "collection_kind_changed", collection, from: before.kind, to: after.kind });
        }
        if (before.body !== after.body)
            changes.push({ kind: "body_changed", collection, from: before.body, to: after.body });
        if (!isDeepStrictEqual(before.allowed, after.allowed)) {
            changes.push({
                kind: "allowed_changed",
                collection,
                before: before.allowed,
                after: after.allowed,
                narrowed: narrowed(before.allowed, after.allowed),
            });
        }
        const renames = byField(transforms, "renameField", collection);
        const drops = byField(transforms, "dropField", collection);
        const defaults = byField(transforms, "setDefault", collection);
        const mappings = byField(transforms, "mapOption", collection);
        const removed = [...before.fields.keys()].filter((name) => !after.fields.has(name));
        const added = [...after.fields.keys()].filter((name) => !before.fields.has(name));
        const renamed = new Map();
        for (const rename of renames) {
            if (removed.includes(rename.from) && added.includes(rename.to) && !renamed.has(rename.from)) {
                renamed.set(rename.from, rename.to);
                changes.push({ kind: "field_renamed", collection, from: rename.from, to: rename.to, handledBy: rename.id });
            }
        }
        const renamedTo = new Set(renamed.values());
        const unmatched = new Set();
        for (const name of removed) {
            if (renamed.has(name))
                continue;
            const was = before.fields.get(name);
            const drop = drops.find((item) => item.field === name);
            changes.push({
                kind: "field_removed",
                collection,
                field: name,
                fieldKind: was?.kind ?? "unknown",
                ...(drop && { handledBy: drop.id }),
            });
            const twin = added.find((candidate) => {
                const next = after.fields.get(candidate);
                return (!renamedTo.has(candidate) &&
                    !unmatched.has(candidate) &&
                    next?.signature === was?.signature &&
                    next?.required === was?.required &&
                    isDeepStrictEqual(next?.options, was?.options));
            });
            if (twin !== undefined && !drop) {
                unmatched.add(twin);
                renameHints.push({ scope: "field", collection, from: name, to: twin });
            }
        }
        for (const name of added) {
            if (renamedTo.has(name))
                continue;
            const next = after.fields.get(name);
            const fallback = defaults.find((item) => item.field === name);
            changes.push({
                kind: "field_added",
                collection,
                field: name,
                fieldKind: next?.kind ?? "unknown",
                required: next?.required === true,
                ...(fallback && { handledBy: fallback.id }),
            });
        }
        // Fields that exist on both sides (a renamed field is compared under its new name).
        const pairs = [];
        for (const [name, was] of before.fields) {
            const now = after.fields.get(renamed.get(name) ?? name);
            if (now)
                pairs.push([now.name, was, now]);
        }
        for (const [name, was, now] of pairs) {
            if (was.signature !== now.signature) {
                changes.push({ kind: "field_type_changed", collection, field: name, from: was.signature, to: now.signature });
            }
            if (was.required !== now.required) {
                const fallback = defaults.find((item) => item.field === name);
                changes.push({
                    kind: "field_required_changed",
                    collection,
                    field: name,
                    required: now.required,
                    ...(fallback && now.required && { handledBy: fallback.id }),
                });
            }
            if (was.localized !== now.localized) {
                changes.push({ kind: "field_locale_changed", collection, field: name, from: was.localized, to: now.localized });
            }
            if (!isDeepStrictEqual(was.branch, now.branch)) {
                changes.push({ kind: "field_moved", collection, field: name, from: was.branch, to: now.branch });
            }
            if (was.kind === "select" && now.kind === "select") {
                const optionsAdded = now.options.filter((option) => !was.options.includes(option));
                const optionsRemoved = was.options.filter((option) => !now.options.includes(option));
                const renamedOptions = new Set();
                for (const option of optionsRemoved) {
                    const mapping = mappings.find((item) => item.field === name && item.from === option);
                    if (mapping && optionsAdded.includes(mapping.to)) {
                        renamedOptions.add(mapping.to);
                        changes.push({
                            kind: "option_renamed",
                            collection,
                            field: name,
                            from: option,
                            to: mapping.to,
                            handledBy: mapping.id,
                        });
                    }
                    else {
                        changes.push({
                            kind: "option_removed",
                            collection,
                            field: name,
                            option,
                            ...(mapping && { handledBy: mapping.id }),
                        });
                    }
                }
                for (const option of optionsAdded) {
                    if (!renamedOptions.has(option))
                        changes.push({ kind: "option_added", collection, field: name, option });
                }
            }
        }
    }
    return { changes, renameHints };
}
/** A short English description of a change, for the command line and logs. A screen words its own. */
export function describeSchemaChange(change) {
    const where = "collection" in change ? `${change.collection}` : "";
    switch (change.kind) {
        case "collection_added":
            return `collection "${change.collection}" added`;
        case "collection_removed":
            return `collection "${change.collection}" removed`;
        case "collection_kind_changed":
            return `collection "${change.collection}" changed from ${change.from} to ${change.to}`;
        case "body_changed":
            return `${where}: body ${change.to ? "added" : "removed"}`;
        case "allowed_changed":
            return `${where}: allowed blocks, marks or headings ${change.narrowed ? "narrowed" : "changed"}`;
        case "field_added":
            return `${where}.${change.field} added (${change.fieldKind}${change.required ? ", required" : ""})`;
        case "field_removed":
            return `${where}.${change.field} removed (${change.fieldKind})`;
        case "field_renamed":
            return `${where}.${change.from} renamed to ${change.to}`;
        case "field_type_changed":
            return `${where}.${change.field} type changed from ${change.from} to ${change.to}`;
        case "field_required_changed":
            return `${where}.${change.field} ${change.required ? "became required" : "is no longer required"}`;
        case "field_locale_changed":
            return `${where}.${change.field} language handling changed from ${change.from} to ${change.to}`;
        case "field_moved":
            return `${where}.${change.field} moved from ${branchText(change.from)} to ${branchText(change.to)}`;
        case "option_added":
            return `${where}.${change.field} option "${change.option}" added`;
        case "option_removed":
            return `${where}.${change.field} option "${change.option}" removed`;
        case "option_renamed":
            return `${where}.${change.field} option "${change.from}" renamed to "${change.to}"`;
        case "locale_added":
            return `locale "${change.locale}" added`;
        case "locale_removed":
            return `locale "${change.locale}" removed`;
        case "default_locale_changed":
            return `default locale changed from "${change.from}" to "${change.to}"`;
    }
}
const branchText = (branch) => (branch ? `${branch.field}=${branch.value}` : "no condition");
