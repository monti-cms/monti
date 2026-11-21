import { z } from "zod";
import type { FieldSchema, ValueFieldSchema } from "../../engine/types";
import { timestampInput, uuidInput } from "../_shared/input";

/** 값 하나, `many`이면 그 목록. */
function oneOrMany(schema: z.ZodType, many: boolean | undefined): z.ZodType {
	return many ? z.array(schema) : schema;
}

/** 값 필드가 받는 값. 참조가 가리키는 대상은 DB에서 따로 검사한다. */
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

type ConditionalField = Extract<FieldSchema, { type: "conditional" }>;

/** `{ option, fields }`: 분기 하나와 그 분기의 하위 필드만. */
function conditionalSchema(field: ConditionalField): z.ZodType {
	const branches = Object.entries(field.options).map(([option, branch]) =>
		z.strictObject({ option: z.literal(option), fields: fieldsSchema(branch.fields) }),
	);
	return z.union(branches);
}

/** `fields`의 값들: 스키마에 없는 키는 거절하고, 작업본은 어느 필드든 비워 둘 수 있다. */
export function fieldsSchema(fields: Record<string, FieldSchema>): z.ZodType {
	const shape = Object.fromEntries(
		Object.entries(fields).map(([key, field]) => [
			key,
			(field.type === "conditional" ? conditionalSchema(field) : valueSchema(field)).optional(),
		]),
	);
	return z.strictObject(shape);
}
