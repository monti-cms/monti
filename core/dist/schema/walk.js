/** Stored field list. Follows declaration order, and fields dependent on a conditional field come right after that field. */
export function valueFieldsOf(schema) {
    const result = [];
    for (const [name, field] of Object.entries(schema.fields)) {
        // The address goes in the content column, and a reverse relation is stored on the other record. View fields are not stored.
        if (field.kind === "slug" || field.kind === "backlink" || field.kind === "view")
            continue;
        if (field.kind === "conditional") {
            result.push({ name, field: field.discriminant });
            for (const [value, group] of Object.entries(field.values)) {
                for (const [nestedName, nested] of Object.entries(group ?? {})) {
                    result.push({ name: nestedName, field: nested, when: { field: name, value } });
                }
            }
            continue;
        }
        result.push({ name, field });
    }
    return result;
}
/** The stored field with that role (`role`). `undefined` if none. */
export function fieldWithRole(schema, role) {
    return valueFieldsOf(schema).find((stored) => stored.field.role === role);
}
/** The value (string) of that role's field. `""` if the field is missing or the value is not a string. */
export function valueWithRole(schema, role, values) {
    const stored = fieldWithRole(schema, role);
    const value = stored ? values[stored.name] : undefined;
    return typeof value === "string" ? value : "";
}
