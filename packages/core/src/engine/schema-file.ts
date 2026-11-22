import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { MontiError } from "./errors";
import type { FieldSchema, Schema, ValueFieldSchema } from "./types";

const fieldMeta = {
	required: z.boolean().optional(),
	label: z.string().optional(),
	description: z.string().optional(),
};

const many = z.boolean().optional();

const valueField = z.discriminatedUnion("type", [
	z.object({ ...fieldMeta, type: z.literal("text"), max: z.number().optional() }),
	z.object({ ...fieldMeta, type: z.literal("number") }),
	z.object({ ...fieldMeta, type: z.literal("boolean") }),
	z.object({ ...fieldMeta, type: z.literal("date") }),
	z.object({ ...fieldMeta, type: z.literal("select"), options: z.array(z.string()), many }),
	z.object({ ...fieldMeta, type: z.literal("media"), many }),
	z.object({ ...fieldMeta, type: z.literal("relation"), to: z.string(), many }),
]);

const conditionalField = z.object({
	...fieldMeta,
	type: z.literal("conditional"),
	options: z.record(z.string(), z.object({ fields: z.record(z.string(), valueField) })),
});

/** 스키마와 상관없이 늘 있는 `<collection>_data` 열. */
export const fixedDataColumns = ["entry_id", "locale", "status", "slug", "published_at", "translation_seen"] as const;

/** 필드(하위 필드 포함) 이름으로 쓸 수 없는 이름: 데이터 테이블의 고정 열과 본문 열 `body`. */
const reservedFieldKeys: readonly string[] = [...fixedDataColumns, "body"];

const fields = z.record(z.string(), z.discriminatedUnion("type", [...valueField.options, conditionalField]));

/** 필드 키와 조건부 필드의 하위 필드 키 모두. */
function fieldKeysOf(collectionFields: z.infer<typeof fields>): string[] {
	return Object.entries(collectionFields).flatMap(([key, field]) =>
		field.type === "conditional"
			? [key, ...Object.values(field.options).flatMap((option) => Object.keys(option.fields))]
			: [key],
	);
}

const collection = z.object({
	body: z.boolean().optional(),
	label: z.string().optional(),
	description: z.string().optional(),
	fields: fields.refine(
		(collectionFields) => !fieldKeysOf(collectionFields).some((key) => reservedFieldKeys.includes(key)),
		{
			message: "데이터 테이블의 고정 열 이름은 필드 이름으로 쓸 수 없습니다",
		},
	),
});

/** 코어 고정 테이블 이름. 컬렉션 테이블 이름과 겹치면 안 된다. */
const reservedKeys = [
	"templates",
	"folders",
	"media",
	"media_uses",
	"loose_files",
	"admin",
	"session",
	"api_keys",
	"migrations",
];

/** 고정 테이블 이름도, `_data`·`_rels`로 끝나는 이름도 아닌 컬렉션 키인지. */
function isCollectionKey(key: string): boolean {
	return !reservedKeys.includes(key) && !key.endsWith("_data") && !key.endsWith("_rels");
}

function hasCollectionKeys(collections: Record<string, unknown>): boolean {
	return Object.keys(collections).every(isCollectionKey);
}

type Collections = Record<string, z.infer<typeof collection>>;

type ConditionalField = Extract<FieldSchema, { type: "conditional" }>;

/** 조건부 필드의 하위 필드 하나: 분기 이름, 하위 필드 키, 그 값 필드와 저장 열 이름 `<field>__<option>__<subfield>`. */
interface Subfield {
	option: string;
	sub: string;
	column: string;
	field: ValueFieldSchema;
}

/** 조건부 필드 `key`의 모든 분기의 하위 필드를 저장 열 이름과 함께 펼친다. */
export function subfieldsOf(key: string, field: ConditionalField): Subfield[] {
	return Object.entries(field.options).flatMap(([option, branch]) =>
		Object.entries(branch.fields).map(([sub, subfield]) => ({
			option,
			sub,
			column: `${key}__${option}__${sub}`,
			field: subfield,
		})),
	);
}

/** 값 필드 하나와 그 열 이름 바탕: 최상위 필드는 `<field>`, 조건부 하위 필드는 `<field>__<option>__<subfield>`. */
interface NamedField {
	column: string;
	field: ValueFieldSchema;
}

/** 최상위 값 필드와 조건부 필드의 모든 하위 필드를 열 이름 바탕과 함께. */
function namedFieldsOf(collectionFields: z.infer<typeof fields>): NamedField[] {
	return Object.entries(collectionFields).flatMap(([key, field]): NamedField[] =>
		field.type !== "conditional" ? [{ column: key, field }] : subfieldsOf(key, field),
	);
}

/** 컬렉션 하나의 키: 컬렉션 키, 필드 키(하위 필드 포함), 조건부 분기 이름. */
function keysOf(key: string, collectionFields: z.infer<typeof fields>): string[] {
	const branches = Object.values(collectionFields)
		.filter((field) => field.type === "conditional")
		.flatMap((field) => Object.keys(field.options));
	return [key, ...fieldKeysOf(collectionFields), ...branches];
}

/** 키에 쓸 수 없는 문자열: SQL 식별자를 감싸는 큰따옴표, 점, 하위 필드 열 이름을 잇는 연속 밑줄. */
const forbiddenInKeys = ['"', ".", "__"];

/** 모든 컬렉션의 키에 금지된 문자열이 없는지. */
function hasAllowedKeys(collections: Collections): boolean {
	return Object.entries(collections).every(([key, { fields: collectionFields }]) =>
		keysOf(key, collectionFields).every((name) => !forbiddenInKeys.some((part) => name.includes(part))),
	);
}

/** 컬렉션 하나가 만들 테이블·열 이름: `<collection>_data`, `<collection>_rels`, 값 필드 열(조건부 하위 열 포함), `<to>_id`. */
function createdNamesOf(key: string, collectionFields: z.infer<typeof fields>): string[] {
	const named = namedFieldsOf(collectionFields);
	const targets = named.flatMap(({ field }) => (field.type === "relation" ? [`${field.to}_id`] : []));
	return [`${key}_data`, `${key}_rels`, ...named.map(({ column }) => column), ...targets];
}

/** PostgreSQL 식별자 한도(UTF-8 바이트). DB는 이보다 긴 이름을 오류 없이 잘라 만든다. */
const MAX_IDENTIFIER_BYTES = 63;

/** 모든 컬렉션의 키와 만들어질 테이블·열 이름이 식별자 한도 안인지. */
function fitsIdentifiers(collections: Collections): boolean {
	return Object.entries(collections).every(([key, { fields: collectionFields }]) =>
		[...keysOf(key, collectionFields), ...createdNamesOf(key, collectionFields)].every(
			(name) => Buffer.byteLength(name) <= MAX_IDENTIFIER_BYTES,
		),
	);
}

/** 모든 관계 필드(조건부 하위 필드 포함)의 `to`가 같은 스키마의 컬렉션인지. */
function hasRelationTargets(collections: Collections): boolean {
	return Object.values(collections).every(({ fields: collectionFields }) =>
		namedFieldsOf(collectionFields).every(
			({ field }) => field.type !== "relation" || Object.hasOwn(collections, field.to),
		),
	);
}

/**
 * 사용자 스키마가 가져야 할 모양: 필드는 정의된 8종이고, 컬렉션 키는 예약어가 아니며, 키에 금지된 문자열이 없고, 키와
 * 만들어질 테이블·열 이름은 식별자 한도 안이며, 관계 필드는 같은 스키마의 컬렉션을 가리킨다.
 */
export const schemaShape: z.ZodType<Schema> = z.object({
	locales: z.array(z.string()),
	collections: z
		.record(z.string(), collection)
		.refine(hasCollectionKeys, {
			message: "코어 기본 테이블 이름이나 _data·_rels로 끝나는 이름은 컬렉션 이름으로 쓸 수 없습니다",
		})
		.refine(hasAllowedKeys, { message: "키에는 큰따옴표, 점, 연속 밑줄을 쓸 수 없습니다" })
		.refine(fitsIdentifiers, { message: "키나 만들어질 테이블·열 이름이 UTF-8 63바이트를 넘습니다" })
		.refine(hasRelationTargets, { message: "관계 필드의 `to`가 스키마에 없는 컬렉션입니다" }),
});

/** `schemaShape`로 검사해 모르는 키를 뺀 스키마를 돌려준다. 올바르지 않으면 `BAD_REQUEST`로 거절한다. */
export function validSchema(value: Schema): Schema {
	const result = schemaShape.safeParse(value);
	if (!result.success) {
		throw new MontiError(
			"BAD_REQUEST",
			`스키마가 올바르지 않다: ${z.prettifyError(result.error)}`,
			result.error.issues,
		);
	}
	return result.data;
}

/** 스키마를 `monti.schema.ts`에 모듈의 기본 내보내기로 쓴다. */
export async function writeSchemaFile(file: string, schema: Schema): Promise<void> {
	await writeFile(file, `export default ${JSON.stringify(schema, null, "\t")};\n`);
}
