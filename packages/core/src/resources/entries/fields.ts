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

/** `{ option, fields }`: one of the field's options and only that option's sub-fields. */
function conditionalSchema(field: Extract<FieldSchema, { type: "conditional" }>): z.ZodType {
	const branches = Object.entries(field.options).map(([option, branch]) =>
		z.strictObject({ option: z.literal(option), fields: fieldsSchema(branch.fields) }),
	);
	return z.union(branches);
}

/** The values of `fields`: a key the schema does not define is rejected, and a working copy may leave any field out. */
export function fieldsSchema(fields: Record<string, FieldSchema>): z.ZodType {
	const shape = Object.fromEntries(
		Object.entries(fields).map(([key, field]) => [
			key,
			(field.type === "conditional" ? conditionalSchema(field) : valueSchema(field)).optional(),
		]),
	);
	return z.strictObject(shape);
}

/** A conditional field's stored value: the chosen option and that option's sub-field values. */
export interface ConditionalValue {
	option: string;
	fields: Record<string, unknown>;
}
