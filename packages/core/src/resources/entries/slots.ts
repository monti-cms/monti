import { subfieldsOf } from "../../engine/schema-file";
import type { CollectionSchema, FieldSchema, ValueFieldSchema } from "../../engine/types";

/**
 * 값 필드 하나가 저장되는 자리. 최상위 필드는 `<field>` 열(다건 참조는 `_rels`의 `path`)에, 조건부 하위 필드는
 * `<field>__<option>__<subfield>` 열(다건 참조는 `<field>.<option>.<subfield>` 경로)에 담긴다.
 */
export interface Slot {
	field: ValueFieldSchema;
	/** 최상위 필드 키. */
	key: string;
	/** 조건부 하위 필드일 때 분기와 하위 필드 키. */
	option?: string;
	sub?: string;
	column: string;
	/** `_rels.path`이자 `media_uses.field_path`. */
	path: string;
}

type ConditionalField = Extract<FieldSchema, { type: "conditional" }>;

/** 선택한 분기 값: 분기 이름과 그 분기의 하위 필드 값. */
export interface ConditionalValue {
	option: string;
	fields: Record<string, unknown>;
}

function branchSlots(key: string, field: ConditionalField): Slot[] {
	return subfieldsOf(key, field).map((subfield) => ({
		...subfield,
		key,
		path: `${key}.${subfield.option}.${subfield.sub}`,
	}));
}

/** 컬렉션의 모든 값 필드 자리. 조건부 필드는 분기마다 하위 필드 자리로 펼친다. */
export function slotsOf(collection: CollectionSchema): Slot[] {
	return Object.entries(collection.fields).flatMap(([key, field]) =>
		field.type === "conditional" ? branchSlots(key, field) : [{ field, key, column: key, path: key }],
	);
}

/** 참조 필드가 가리키는 테이블: `media` 또는 관계의 `to` 컬렉션. 참조가 아니면 undefined. */
export function targetOf(field: ValueFieldSchema): string | undefined {
	if (field.type === "media") return "media";
	return field.type === "relation" ? field.to : undefined;
}

/** `_rels`에 담기는 다건 참조 필드인지. */
export function isMany(field: ValueFieldSchema): boolean {
	return targetOf(field) !== undefined && "many" in field && field.many === true;
}

/** `fields`에서 자리 하나의 값. 조건부 하위 필드는 그 분기가 선택되었을 때만 값이 있다. */
function valueAt(fields: Record<string, unknown>, slot: Slot): unknown {
	const value = fields[slot.key];
	if (slot.sub === undefined) return value;
	const chosen = value as ConditionalValue | undefined;
	return chosen !== undefined && chosen.option === slot.option ? chosen.fields[slot.sub] : undefined;
}

/** `fields`가 채운 자리와 그 값. */
export function valuesOf(collection: CollectionSchema, fields: Record<string, unknown>) {
	return slotsOf(collection)
		.map((slot) => ({ slot, value: valueAt(fields, slot) }))
		.filter(({ value }) => value !== undefined);
}
