import { checkPathPattern, patternsOverlap } from "../../core/path-pattern.js";
import { DEFAULT_TITLE_FIELD, TITLE_ROLE } from "../../schema/fields.js";
import { findTitleField, valueFieldsOf } from "../../schema/walk.js";
import { NAME_PATTERN } from "../rules.js";
import { checkField, checkRole, checkTabName } from "./fields.js";
import { pathOf } from "./issue.js";
/** The collections of a config, checked against each other. `defineSite` runs it for every source. */
export function checkCollections(list, collections) {
    const names = Object.keys(collections);
    if (names.length === 0)
        list.add("collections", "empty", "needs at least one collection");
    const paths = new Map();
    for (const [name, schema] of Object.entries(collections)) {
        checkCollection(list, name, schema, collections);
        if (schema.path === undefined || checkPathPattern(schema.path))
            continue;
        for (const [otherPath, other] of paths) {
            if (patternsOverlap(schema.path, otherPath)) {
                list.add(pathOf("collections", name, "path"), "path-overlap", `"${schema.path}" can make the same URL as collections.${other}.path "${otherPath}"`);
            }
        }
        paths.set(schema.path, name);
    }
}
/** One collection: its fields and their roles, its title, layout, public address, and the fields that point to other collections. */
export function checkCollection(list, name, schema, collections) {
    const base = pathOf("collections", name);
    if (!NAME_PATTERN.test(name)) {
        list.add(base, "name", `"${name}" is not a collection name: letters, digits, "_" and "-", starting with a letter or "_"`);
    }
    const entries = Object.entries(schema.fields);
    const env = {
        collectionNames: Object.keys(collections),
        collections,
        fields: schema.fields,
        body: schema.body,
    };
    const slugs = entries.filter(([, field]) => field.kind === "slug");
    if (slugs.length > 1) {
        list.add(pathOf(base, "fields"), "many-slugs", `has more than one slug field (${slugs.map(([slug]) => slug).join(", ")}); a collection has one address`);
    }
    for (const [fieldName, field] of entries) {
        const at = pathOf(base, "fields", fieldName);
        checkField(list, at, fieldName, field, env);
        if (field.kind === "conditional") {
            for (const [option, group] of Object.entries(field.values ?? {})) {
                for (const [nestedName, nested] of Object.entries(group ?? {})) {
                    const nestedAt = pathOf(at, "values", option, nestedName);
                    checkField(list, nestedAt, nestedName, nested, env);
                }
            }
        }
        if (field.kind === "backlink")
            checkBacklink(list, at, name, field, collections);
    }
    checkRoles(list, base, schema);
    checkTitle(list, base, schema);
    if (schema.defaultTab !== undefined) {
        checkTabName(list, pathOf(base, "defaultTab"), schema.defaultTab);
    }
    for (const [index, group] of (schema.layout ?? []).entries()) {
        const at = pathOf(base, "layout", index);
        checkTabName(list, pathOf(at, "tab"), group.tab);
        for (const [position, fieldName] of group.fields.entries()) {
            if (!Object.hasOwn(schema.fields, fieldName)) {
                list.add(pathOf(at, "fields", position), "unknown-field", `"${fieldName}" is not a field of ${name}`);
            }
        }
    }
    if (schema.path !== undefined) {
        const problem = checkPathPattern(schema.path);
        if (problem)
            list.add(pathOf(base, "path"), `path-${problem.code}`, problem.message);
        else if (slugs.length === 0)
            list.add(pathOf(base, "path"), "path-needs-slug", "needs a slug field to fill the address");
    }
}
/** A backlink reads a many relation of the other collection that points back here. */
function checkBacklink(list, path, collection, field, collections) {
    const source = collections[field.from];
    if (!source)
        return;
    const via = valueFieldsOf(source).find((stored) => stored.name === field.via)?.field;
    if (via?.kind !== "relation" || !via.many || via.to !== collection) {
        list.add(pathOf(path, "via"), "backlink-via", `needs ${field.from}.${field.via} to be a many relation to "${collection}"`);
    }
}
/** Roles are unique in a collection, and the title role cannot sit inside a conditional field. */
function checkRoles(list, base, schema) {
    const seen = new Map();
    const carriers = [
        ...valueFieldsOf(schema).map(({ name, field, when }) => ({
            name,
            field: field,
            path: when ? pathOf(base, "fields", when.field, "values", when.value, name) : pathOf(base, "fields", name),
            nested: when !== undefined,
        })),
        ...Object.entries(schema.fields)
            .filter(([, field]) => field.kind === "slug")
            .map(([name, field]) => ({ name, field, path: pathOf(base, "fields", name), nested: false })),
    ];
    for (const { name, field, path, nested } of carriers) {
        const { role } = field;
        if (role === undefined)
            continue;
        checkRole(list, path, field);
        if (role === TITLE_ROLE && nested) {
            list.add(pathOf(path, "role"), "title-nested", `"${role}" cannot be on a field of a conditional field`);
        }
        const other = seen.get(role);
        if (other)
            list.add(pathOf(path, "role"), "role-twice", `"${role}" is also the role of ${other}; a role has one field`);
        else
            seen.set(role, name);
    }
}
/** Every collection has a title field, and the name `title` is kept for it. */
function checkTitle(list, base, schema) {
    const title = findTitleField(schema);
    if (!title) {
        list.add(pathOf(base, "fields"), "title-missing", `needs a title field: a text field with role "${TITLE_ROLE}" (or one named "${DEFAULT_TITLE_FIELD}")`);
        return;
    }
    if (title.name !== DEFAULT_TITLE_FIELD && Object.hasOwn(schema.fields, DEFAULT_TITLE_FIELD)) {
        list.add(pathOf(base, "fields", DEFAULT_TITLE_FIELD), "title-name-taken", `is not the title field (${title.name} has the role "${TITLE_ROLE}"); rename it`);
    }
}
