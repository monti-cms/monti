import { isObj, optionsOf, titleFieldName } from "./schema-model.js";
const SEPARATOR = " · ";
/** The label of the collection a relation points to (the file's), else its name. */
function collectionLabel(file, name) {
    const collections = isObj(file.collections) ? file.collections : {};
    const label = collections[name]?.label;
    return typeof label === "string" && label !== "" ? label : name;
}
/** One line for a field of a collection: its kind token, whether it is required, and its settings in a few words. */
export function summarizeField(t, name, field, collection, file, topLevel) {
    const kind = String(field.kind);
    const parts = [];
    const isTitle = topLevel && titleFieldName(collection) === name;
    let token = kind;
    let tone = "text";
    switch (kind) {
        case "text": {
            if (field.multiline === true)
                parts.push(t("sum.multiline"));
            if (typeof field.max === "number")
                parts.push(t("sum.max", { count: field.max }));
            if (field.fillFromBody)
                parts.push(t("sum.fill"));
            break;
        }
        case "slug": {
            tone = "slug";
            if (typeof field.from === "string")
                parts.push(t("sum.slugFrom", { field: field.from }));
            break;
        }
        case "relation": {
            tone = "relation";
            const to = typeof field.to === "string" ? collectionLabel(file, field.to) : "?";
            token = `→ ${to}${field.many === true ? "[]" : ""}`;
            if (field.many === true)
                parts.push(t("sum.many"));
            if (field.many === true && field.ordered === true)
                parts.push(t("sum.ordered"));
            if (field.createInline === true)
                parts.push(t("sum.inline"));
            if (field.publishedOnly === true)
                parts.push(t("sum.publishedOnly"));
            break;
        }
        case "backlink": {
            tone = "backlink";
            const from = typeof field.from === "string" ? field.from : "?";
            token = `← ${collectionLabel(file, from)}`;
            parts.push(t("sum.backlink", { from: collectionLabel(file, from), via: String(field.via ?? "?") }));
            break;
        }
        case "select": {
            tone = "select";
            parts.push(Object.keys(optionsOf(field)).join(" | "));
            break;
        }
        case "conditional": {
            tone = "conditional";
            token = "one of";
            parts.push(Object.keys(optionsOf(field)).join(" | "));
            break;
        }
        case "media": {
            tone = "media";
            if ((field.accept ?? "image") === "image")
                parts.push(t("sum.images"));
            break;
        }
        case "view": {
            tone = "view";
            parts.push(t("sum.view", { view: String(field.view ?? "") }));
            break;
        }
    }
    if (field.localized === true && kind !== "conditional")
        parts.push(t("sum.localized"));
    return {
        token,
        tone,
        required: field.required === true,
        isTitle,
        detail: parts.filter((part) => part !== "").join(SEPARATOR),
    };
}
/** The fields of one option of a conditional field (empty when the option adds none). */
export function branchFields(field, option) {
    const values = isObj(field.values) ? field.values : {};
    return values[option] ?? {};
}
