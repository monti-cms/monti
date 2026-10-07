import type { CollectionSchema } from "./collection";
import { DEFAULT_TITLE_FIELD, type FieldRole, type TextField, TITLE_ROLE, type ValueField } from "./fields";

/**
 * Pure function that reads one collection definition. It reads no site, so it is used by extensions the config file imports
 * (e.g. an extension's field checks and public-page helpers) and by `defineSite`. The functions that look a collection up by name are members of a `Site` (`createSchemas` in `derive.ts`).
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

/** The title field of a collection: a stored text field. */
export type TitleField = StoredField & { readonly field: TextField };

/**
 * The title field of a collection: the field with the `title` role, or, when none has it, the field named `title`. `undefined` if there is none
 * (`defineSite` rejects such a collection, so a checked config always has one). This is the only place that knows the default name:
 * everything that reads or writes the title (SQL included, see `titleExpr`) goes through it.
 */
export function findTitleField(schema: Pick<CollectionSchema, "fields">): TitleField | undefined {
	const stored = valueFieldsOf(schema);
	const found =
		stored.find((item) => item.field.role === TITLE_ROLE) ?? stored.find((item) => item.name === DEFAULT_TITLE_FIELD);
	return found && found.field.kind === "text" && !found.when ? (found as TitleField) : undefined;
}

/** The title field of a (checked) collection. Throws if there is none, which `defineSite` has already rejected. */
export function titleFieldOf(schema: Pick<CollectionSchema, "fields">): TitleField {
	const found = findTitleField(schema);
	if (!found) {
		throw new Error(
			`collection has no title field (a text field with role "${TITLE_ROLE}", or one named "${DEFAULT_TITLE_FIELD}")`,
		);
	}
	return found;
}

/** The title in stored values (metadata): the value of the title field. `null` if it is not a string. */
export function titleValue(
	schema: Pick<CollectionSchema, "fields">,
	values: { readonly [key: string]: unknown },
): string | null {
	const value = values[titleFieldOf(schema).name];
	return typeof value === "string" ? value : null;
}
