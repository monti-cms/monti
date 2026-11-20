import { z } from "zod";
import type { FieldSchema, ValueFieldSchema } from "../../engine/types";
import { timestampInput, uuidInput } from "../_shared/input";

/** One value, or a list of them when the field is `many`. */
function oneOrMany(schema: z.ZodType, many: boolean | undefined): z.ZodType {
	return many ? z.array(schema) : schema;
}

/** What a value field accepts; references are checked against the database separately. */
function valueSchema(field: ValueFieldSchema): z.ZodType {
	switch (field.type) {
		case "text":
			return field.max === undefined ? z.string() : z.string().max(field.max);
		case "number":
			return z.number();
		case "boolean":
			return z.boolean();
		case "date":
			return timestampInput;
		case "select":
			return oneOrMany(z.enum(field.options), field.many);
		case "media":
		case "relation":
			return oneOrMany(uuidInput, field.many);
	}
}

type ConditionalFieldSchema = Extract<FieldSchema, { type: "conditional" }>;

/**
 * What a field key the schema does not define does: a write rejects it; publishing stored data drops it, as a field
 * removed from the schema may have left a value behind.
 */
export type UnknownKeys = "reject" | "drop";

/** `{ option, fields }`: one of the field's options and only that option's sub-fields; the wrapper itself is always strict. */
function conditionalSchema(field: ConditionalFieldSchema, unknownKeys: UnknownKeys): z.ZodType {
	const branches = Object.entries(field.options).map(([option, branch]) =>
		z.strictObject({ option: z.literal(option), fields: fieldsSchema(branch.fields, unknownKeys) }),
	);
	return z.union(branches);
}

/** The values of `fields`: a key the schema does not define is rejected or dropped, and a working copy may leave any field out. */
export function fieldsSchema(fields: Record<string, FieldSchema>, unknownKeys: UnknownKeys = "reject"): z.ZodType {
	const shape = Object.fromEntries(
		Object.entries(fields).map(([key, field]) => [
			key,
			(field.type === "conditional" ? conditionalSchema(field, unknownKeys) : valueSchema(field)).optional(),
		]),
	);
	return unknownKeys === "reject" ? z.strictObject(shape) : z.object(shape);
}

/** A conditional field's stored value: the chosen option and that option's sub-field values. */
export interface ConditionalValue {
	option: string;
	fields: Record<string, unknown>;
}

/** The field `key` names in `fields`; undefined for a key the schema no longer defines, `constructor` and the like included. */
export function fieldOf(fields: Record<string, FieldSchema>, key: string): FieldSchema | undefined {
	return Object.hasOwn(fields, key) ? fields[key] : undefined;
}

/** Whether a stored conditional value is `{ option, fields }` with an option the field still has. */
export function isKnownOption(field: ConditionalFieldSchema, value: unknown): value is ConditionalValue {
	if (typeof value !== "object" || value === null || !("option" in value) || !("fields" in value)) return false;
	const { option, fields } = value;
	return (
		typeof option === "string" &&
		Object.hasOwn(field.options, option) &&
		typeof fields === "object" &&
		fields !== null &&
		!Array.isArray(fields)
	);
}
