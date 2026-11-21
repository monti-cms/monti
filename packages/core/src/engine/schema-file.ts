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

/** 사용자 스키마가 가져야 할 모양: 필드는 정의된 8종이고, 컬렉션 키는 예약어가 아니다. */
export const schemaShape: z.ZodType<Schema> = z.object({
	locales: z.array(z.string()),
	collections: z.record(z.string(), collection).refine(hasCollectionKeys, {
		message: "코어 기본 테이블 이름이나 _data·_rels로 끝나는 이름은 컬렉션 이름으로 쓸 수 없습니다",
	}),
});

/** 스키마를 `monti.schema.ts`에 모듈의 기본 내보내기로 쓴다. */
export async function writeSchemaFile(file: string, schema: Schema): Promise<void> {
	await writeFile(file, `export default ${JSON.stringify(schema, null, "\t")};\n`);
}
