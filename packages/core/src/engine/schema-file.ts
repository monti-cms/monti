import { writeFile } from "node:fs/promises";
import { z } from "zod";
import type { Schema } from "./types";

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

/** 값 필드 하나와 그 열 이름 바탕: 최상위 필드는 `<field>`, 조건부 하위 필드는 `<field>__<option>__<subfield>`. */
interface NamedField {
	column: string;
	field: z.infer<typeof valueField>;
}

/** 최상위 값 필드와 조건부 필드의 모든 하위 필드를 열 이름 바탕과 함께. */
function namedFieldsOf(collectionFields: z.infer<typeof fields>): NamedField[] {
	return Object.entries(collectionFields).flatMap(([key, field]): NamedField[] =>
		field.type !== "conditional"
			? [{ column: key, field }]
			: Object.entries(field.options).flatMap(([option, branch]) =>
					Object.entries(branch.fields).map(([sub, subfield]) => ({
						column: `${key}__${option}__${sub}`,
						field: subfield,
					})),
				),
	);
}

/** 값 필드가 만드는 열 이름: 단건은 `_data`의 그 열, 다건 관계는 `_rels`의 `<to>_id` 열, 다건 미디어는 고정 열 `media_id`를 쓴다. */
function columnsOf({ column, field }: NamedField): string[] {
	if (field.type === "relation" && field.many === true) return [`${field.to}_id`];
	return field.type === "media" && field.many === true ? [] : [column];
}

/** 컬렉션 `key`가 만들 테이블과 열의 이름: 세 테이블, 조건부 필드가 고른 분기를 담는 열, 값 필드의 열. */
function identifiersOf(key: string, collectionFields: z.infer<typeof fields>): string[] {
	const branchColumns = Object.keys(collectionFields).filter((name) => collectionFields[name].type === "conditional");
	return [key, `${key}_data`, `${key}_rels`, ...branchColumns, ...namedFieldsOf(collectionFields).flatMap(columnsOf)];
}

/** PostgreSQL 식별자 한도(UTF-8 바이트). DB는 이보다 긴 이름을 오류 없이 잘라 만든다. */
const MAX_IDENTIFIER_BYTES = 63;

/** 모든 컬렉션이 만들 테이블·열 이름이 식별자 한도 안인지. */
function fitsIdentifiers(collections: Collections): boolean {
	return Object.entries(collections).every(([key, { fields: collectionFields }]) =>
		identifiersOf(key, collectionFields).every((name) => Buffer.byteLength(name, "utf8") <= MAX_IDENTIFIER_BYTES),
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
 * 사용자 스키마가 가져야 할 모양: 필드는 정의된 8종이고, 컬렉션 키는 예약어가 아니며, 만들어질 테이블·열 이름은 식별자
 * 한도 안이고, 관계 필드는 같은 스키마의 컬렉션을 가리킨다.
 */
export const schemaShape: z.ZodType<Schema> = z.object({
	locales: z.array(z.string()),
	collections: z
		.record(z.string(), collection)
		.refine(hasCollectionKeys, {
			message: "코어 기본 테이블 이름이나 _data·_rels로 끝나는 이름은 컬렉션 이름으로 쓸 수 없습니다",
		})
		.refine(fitsIdentifiers, { message: "만들어질 테이블이나 열 이름이 UTF-8 63바이트를 넘습니다" })
		.refine(hasRelationTargets, { message: "관계 필드의 `to`가 스키마에 없는 컬렉션입니다" }),
});

/** 스키마를 `monti.schema.ts`에 모듈의 기본 내보내기로 쓴다. */
export async function writeSchemaFile(file: string, schema: Schema): Promise<void> {
	await writeFile(file, `export default ${JSON.stringify(schema, null, "\t")};\n`);
}
