import { disallowedInDocument } from "../schema/allowed.js";
import { changeKey } from "./types.js";
/** Walks every page of `store.scanBodies`, yielding one page at a time. */
export async function* scanAllBodies(store, params = {}) {
    let after;
    do {
        const page = await store.scanBodies({ ...params, after });
        if (page.bodies.length > 0)
            yield page.bodies;
        after = page.next ?? undefined;
    } while (after);
}
const isEmpty = (value) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
const hasValue = (body, field) => !isEmpty(body.metadata[field]);
const holds = (body, field, option) => {
    const value = body.metadata[field];
    return value === option || (Array.isArray(value) && value.includes(option));
};
const hasContent = (body) => body.doc.content.some((node) => !(node.type === "paragraph" && (node.content ?? []).length === 0));
const allowedKeys = (items) => new Set(items.map((item) => `${item.kind}:${item.name}:${item.level ?? ""}`));
function ruleFor(change, options) {
    const inCollection = (body) => "collection" in change && body.collection === change.collection;
    const only = (collection) => [collection];
    switch (change.kind) {
        case "collection_added":
        case "option_added":
        case "locale_added":
        case "default_locale_changed":
            return { collections: null, consequence: "none" };
        case "collection_removed":
            return { collections: only(change.collection), touches: inCollection, consequence: "orphaned" };
        case "collection_kind_changed":
            return { collections: only(change.collection), touches: inCollection, consequence: "kept" };
        case "body_changed":
            return change.to
                ? { collections: null, consequence: "none" }
                : {
                    collections: only(change.collection),
                    touches: (body) => inCollection(body) && hasContent(body),
                    consequence: "kept",
                };
        case "allowed_changed": {
            const { site } = options;
            if (!site)
                return { collections: null, consequence: "warned", checked: false };
            const before = change.before;
            const after = change.after;
            return {
                collections: only(change.collection),
                consequence: "warned",
                touches: (body) => {
                    if (!inCollection(body) || !hasContent(body))
                        return false;
                    const now = disallowedInDocument(site, after, body.doc);
                    if (now.length === 0)
                        return false;
                    const was = allowedKeys(disallowedInDocument(site, before, body.doc));
                    return now.some((item) => !was.has(`${item.kind}:${item.name}:${item.level ?? ""}`));
                },
            };
        }
        case "field_added":
        case "field_required_changed": {
            if (!change.required)
                return { collections: null, consequence: "none" };
            const when = options.site?.storedField(change.collection, change.field)?.when;
            return {
                collections: only(change.collection),
                consequence: "publish_blocked",
                touches: (body) => inCollection(body) &&
                    body.status !== "trashed" &&
                    !hasValue(body, change.field) &&
                    // A translation holds per-language values only; the shared ones are checked on the source.
                    !body.isTranslation &&
                    (!when || body.metadata[when.field] === when.value),
            };
        }
        case "field_removed":
            return {
                collections: only(change.collection),
                touches: (b) => inCollection(b) && hasValue(b, change.field),
                consequence: "orphaned",
            };
        case "field_renamed":
            return {
                collections: only(change.collection),
                touches: (b) => inCollection(b) && hasValue(b, change.from),
                consequence: "orphaned",
            };
        case "field_type_changed":
            return {
                collections: only(change.collection),
                touches: (b) => inCollection(b) && hasValue(b, change.field),
                consequence: "invalid_values",
            };
        case "field_locale_changed":
            return {
                collections: only(change.collection),
                touches: (b) => inCollection(b) && hasValue(b, change.field),
                consequence: "kept",
            };
        case "field_moved": {
            const into = change.to;
            // Moved into a branch: values of entries the branch does not show stay stored but are not shown.
            return {
                collections: into ? only(change.collection) : null,
                consequence: "kept",
                touches: (b) => inCollection(b) && hasValue(b, change.field) && into !== null && b.metadata[into.field] !== into.value,
            };
        }
        case "option_removed":
            return {
                collections: only(change.collection),
                touches: (b) => inCollection(b) && holds(b, change.field, change.option),
                consequence: "unknown_value",
            };
        case "option_renamed":
            return {
                collections: only(change.collection),
                touches: (b) => inCollection(b) && holds(b, change.field, change.from),
                consequence: "unknown_value",
            };
        case "locale_removed":
            return { collections: "all", touches: (b) => b.locale === change.locale, consequence: "orphaned" };
    }
}
/** What the transform that handles a change does to the data. */
function handledConsequence(change, transforms) {
    if (!change.handledBy)
        return undefined;
    const handler = transforms?.find((item) => item.id === change.handledBy);
    return handler?.op === "dropField" ? "deleted" : "transformed";
}
/**
 * Reports which stored entries each change of a diff touches. Read-only: it scans the stored bodies once (`store.scanBodies`) and answers every change from that scan.
 *
 * - `entries` counts entries (an entry counts once even if its draft and its published copy are both touched); `sample` lists the first ones with their title.
 * - `consequence` says what happens to them if the change is applied as it is: kept as orphans, transformed by a transform of the schema file, deleted by a
 *   `dropField`, blocked from publishing until filled, and so on. Nothing is dropped without a `dropField`.
 * - A change that touches nothing in the data (a collection or option added) reports 0.
 */
export async function checkSchemaChange(store, diff, options = {}) {
    const sampleSize = options.sampleSize ?? 5;
    const rules = diff.changes.map((change) => ({ change, rule: ruleFor(change, options) }));
    const scanning = rules.filter(({ rule }) => rule.collections !== null && rule.touches !== undefined);
    // A stored body holds the title under the key it was written with, which is the new title field's name, or the old one while a rename of it is pending.
    const titleKeys = (collection) => {
        if (!options.site?.isCollection(collection))
            return [];
        const key = options.site.titleField(collection).name;
        const renamedFrom = diff.changes.flatMap((change) => change.kind === "field_renamed" && change.collection === collection && change.to === key ? [change.from] : []);
        return [key, ...renamedFrom];
    };
    const titleOfBody = (body) => titleKeys(body.collection)
        .map((key) => body.metadata[key])
        .find((value) => typeof value === "string");
    const counts = rules.map(() => ({ entries: 0, sample: [] }));
    let bodiesRead = 0;
    if (scanning.length > 0) {
        const all = scanning.some(({ rule }) => rule.collections === "all");
        const collections = all
            ? undefined
            : [...new Set(scanning.flatMap(({ rule }) => (Array.isArray(rule.collections) ? rule.collections : [])))];
        let group = [];
        const flush = () => {
            if (group.length === 0)
                return;
            const working = group.find((body) => body.state === "working") ?? group[0];
            if (working) {
                for (const [index, { rule }] of rules.entries()) {
                    if (!rule.touches)
                        continue;
                    if (Array.isArray(rule.collections) && !rule.collections.includes(working.collection))
                        continue;
                    if (!group.some(rule.touches))
                        continue;
                    const count = counts[index];
                    if (!count)
                        continue;
                    count.entries += 1;
                    if (count.sample.length < sampleSize) {
                        const title = titleOfBody(working);
                        count.sample.push({
                            id: working.entryId,
                            title: typeof title === "string" ? title : null,
                            collection: working.collection,
                            locale: working.locale,
                            status: working.status,
                        });
                    }
                }
            }
            group = [];
        };
        for await (const batch of scanAllBodies(store, { collections, limit: options.batchSize })) {
            for (const body of batch) {
                bodiesRead += 1;
                if (group[0] && group[0].entryId !== body.entryId)
                    flush();
                group.push(body);
            }
        }
        flush();
    }
    return {
        bodiesRead,
        impacts: rules.map(({ change, rule }, index) => ({
            change,
            key: changeKey(change),
            entries: counts[index]?.entries ?? 0,
            sample: counts[index]?.sample ?? [],
            consequence: handledConsequence(change, options.transforms) ?? rule.consequence,
            checked: rule.checked ?? true,
        })),
    };
}
