/**
 * Field sets that plugins offer: a group of fields a plugin works with (the SEO extension's search title, description, share image, ...). The
 * schema screen shows one as an "Add <name> fields" action on the Fields tab and writes the fields into the collection as plain data, so the
 * schema file stays a literal that the screen can edit. The plugin finds its fields by role afterwards, as before. This is data (no functions),
 * so it reaches the browser with the rest of `contributes`.
 */
/** The key of `contributes` in which a plugin lists the field sets it offers. */
export const FIELD_SETS_CONTRIBUTION = "fieldSets";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** The field sets the plugins offer, read from their `contributes` (a plugin of the browser's snapshot has it as data). */
export function fieldSetsOf(plugins) {
    return plugins.flatMap((plugin) => {
        const offered = plugin.contributes?.[FIELD_SETS_CONTRIBUTION];
        if (!Array.isArray(offered))
            return [];
        return offered
            .filter((set) => isRecord(set) && typeof set.id === "string" && typeof set.label === "string" && isRecord(set.fields))
            .map((set) => ({ ...set, plugin: plugin.name }));
    });
}
/** Whether a collection (its `fields`) already has the set: any of its fields carries one of the set's roles. */
export function hasFieldSet(set, fields) {
    return Object.values(fields).some((field) => isRecord(field) && typeof field.role === "string" && set.roles.includes(field.role));
}
/**
 * `set.fields` renamed to names `fields` does not use yet (`seoTitle` → `seoTitle2` when taken), in the set's order. The fields themselves are copied
 * as they are.
 */
export function freshSetFields(set, fields) {
    const taken = new Set(Object.keys(fields));
    const added = {};
    for (const [name, field] of Object.entries(set.fields)) {
        let candidate = name;
        for (let n = 2; taken.has(candidate); n++)
            candidate = `${name}${n}`;
        taken.add(candidate);
        added[candidate] = structuredClone(field);
    }
    return added;
}
