import type { CollectionSchema, FieldSchema, ValueFieldSchema } from "../../engine/types";

/** 스키마가 바라는 열 하나. `type`은 `format_type`이 돌려주는 표기와 같다. */
export interface ColumnSpec {
	name: string;
	type: string;
	references?: { table: string; onDelete: "set null" | "cascade" };
}

const scalarTypes = {
	text: "text",
	number: "double precision",
	boolean: "boolean",
	date: "timestamp with time zone",
} as const;

/** 단건 필드 하나의 열. 다건 `media`·`relation`은 `_rels` 테이블에 담기므로 열이 없다. */
function valueColumns(name: string, field: ValueFieldSchema): ColumnSpec[] {
	if (field.type === "media" || field.type === "relation") {
		if (field.many === true) return [];
		const table = field.type === "media" ? "media" : field.to;
		return [{ name, type: "uuid", references: { table, onDelete: "set null" } }];
	}
	if (field.type === "select") return [{ name, type: field.many === true ? "text[]" : "text" }];
	return [{ name, type: scalarTypes[field.type] }];
}

/** 조건부 필드는 선택한 분기 열과 `<field>__<option>__<subfield>` 하위 열로 펼친다. */
function fieldColumns(name: string, field: FieldSchema): ColumnSpec[] {
	if (field.type !== "conditional") return valueColumns(name, field);
	const branches = Object.entries(field.options).flatMap(([option, { fields }]) =>
		Object.entries(fields).flatMap(([sub, subfield]) => valueColumns(`${name}__${option}__${sub}`, subfield)),
	);
	return [{ name, type: "text" }, ...branches];
}

/** `<collection>_data` 테이블에서 기본 열 말고 스키마가 정하는 열: `body`와 필드 열. */
export function dataColumns(collection: CollectionSchema): ColumnSpec[] {
	const body: ColumnSpec[] = collection.body === true ? [{ name: "body", type: "jsonb" }] : [];
	return [...body, ...Object.entries(collection.fields).flatMap(([name, field]) => fieldColumns(name, field))];
}

/** 조건부 필드의 하위 필드까지 펼친 컬렉션의 모든 단일 값 필드. */
function valueFields(collection: CollectionSchema): ValueFieldSchema[] {
	return Object.values(collection.fields).flatMap((field) =>
		field.type === "conditional"
			? Object.values(field.options).flatMap(({ fields }) => Object.values(fields))
			: [field],
	);
}

/** `<collection>_rels` 테이블의 참조 대상 열: `media_id`와 다건 `relation`이 가리키는 컬렉션마다 `<to>_id`. */
export function relsColumns(collection: CollectionSchema): ColumnSpec[] {
	const targets = new Set<string>();
	for (const field of valueFields(collection))
		if (field.type === "relation" && field.many === true) targets.add(field.to);
	return ["media", ...targets].map((table) => ({
		name: `${table}_id`,
		type: "uuid",
		references: { table, onDelete: "cascade" },
	}));
}
