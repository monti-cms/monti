import type { CollectionSchema } from "./collection";
import type { FieldRole, ValueField } from "./fields";

/**
 * Pure function that reads one collection definition. It does not read the site config (`config/resolved.ts`), so it is used by extensions the config file imports
 * (e.g. an extension's field checks and public-page helpers) and by `defineConfig`. The function that looks up by name in the config is in `derive.ts`.
 */

/** A field stored as one value in the metadata. The choice value of a conditional field and its dependent fields are each flattened to one. */
export interface StoredField {
	readonly name: string;
	readonly field: ValueField;
	/** If this is a field dependent on a conditional field, that condition. The value is kept only when the condition matches. */
	readonly when?: { readonly field: string; readonly value: string };
}

/** Stored field list. Follows declaration order, and fields dependent on a conditional field come right after that field. */
export function valueFieldsOf(schema: Pick<CollectionSchema, "fields">): StoredField[] {
	const result: StoredField[] = [];
	for (const [name, field] of Object.entries(schema.fields)) {
		// The address goes in the content column, and a reverse relation is stored on the other record. View fields are not stored.
		if (field.kind === "slug" || field.kind === "backlink" || field.kind === "view") continue;
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
export function fieldWithRole(schema: Pick<CollectionSchema, "fields">, role: FieldRole): StoredField | undefined {
	return valueFieldsOf(schema).find((stored) => stored.field.role === role);
}

/** The value (string) of that role's field. `""` if the field is missing or the value is not a string. */
export function valueWithRole(
	schema: Pick<CollectionSchema, "fields">,
	role: FieldRole,
	values: { readonly [key: string]: unknown },
): string {
	const stored = fieldWithRole(schema, role);
	const value = stored ? values[stored.name] : undefined;
	return typeof value === "string" ? value : "";
}
