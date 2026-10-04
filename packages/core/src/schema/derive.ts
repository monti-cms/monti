import { cmsConfig, type ResolvedConfig } from "../config/resolved";
import { isUuid } from "../core/ids";
import { slugify } from "../core/slug";
import type { CollectionSchema } from "./collection";
import {
	type Field,
	type FieldRole,
	isRequiredField,
	RESERVED_METADATA_KEYS,
	type SlugField,
	type StorageType,
	storageTypeOf,
	type TextField,
	type ValueField,
} from "./fields";
import { type StoredField, valueFieldsOf } from "./walk";

export type { StoredField } from "./walk";

/**
 * 컬렉션 정의에서 저장·검증·참조 규칙을 만든다(v2 B1). 순수 함수이며 DB·HTTP·React를 모른다.
 * 서버(스냅샷 검증)와 브라우저(속성 패널·폼 변환)가 같은 규칙을 쓴다.
 */

// 타입을 적어 배포 타입 선언에 빌드 때의 설정 타입이 굳지 않게 한다(`config/resolved.ts`).
const SCHEMAS: ResolvedConfig["collections"] = cmsConfig.collections;

export type SchemaCollection = keyof typeof SCHEMAS & string;
/** 관계 대상 컬렉션. 정의의 `to`·`from`은 문자열이고, `defineConfig`가 실제 컬렉션인지 확인했다. */
export type RelationTarget = SchemaCollection;

export const schemaOf = (collection: SchemaCollection): CollectionSchema => SCHEMAS[collection];

const storedCache = new Map<SchemaCollection, readonly StoredField[]>();

/** 저장 필드 목록. 선언 순서를 따르고 조건부 필드에 딸린 필드는 그 필드 바로 뒤에 온다. */
export function storedFields(collection: SchemaCollection): readonly StoredField[] {
	const cached = storedCache.get(collection);
	if (cached) return cached;
	const result = Object.freeze(valueFieldsOf(schemaOf(collection)));
	storedCache.set(collection, result);
	return result;
}

export function storedField(collection: SchemaCollection, name: string): StoredField | undefined {
	return storedFields(collection).find((stored) => stored.name === name);
}

export function slugFieldOf(collection: SchemaCollection): SlugField | undefined {
	return Object.values(schemaOf(collection).fields).find((field): field is SlugField => field.kind === "slug");
}

/**
 * 그 역할(`role`)을 가진 저장 필드. 없으면 `undefined`. 라이브러리와 확장 코드는 요약 같은 값을 필드 이름이 아니라
 * 이 함수로 찾는다.
 */
export function roleField(collection: SchemaCollection, role: FieldRole): StoredField | undefined {
	return storedFields(collection).find((stored) => stored.field.role === role);
}

/** 그 역할 필드의 값(문자열). 필드가 없거나 값이 문자열이 아니면 `""`. */
export function roleValue(
	collection: SchemaCollection,
	role: FieldRole,
	values: { readonly [key: string]: unknown },
): string {
	const stored = roleField(collection, role);
	const value = stored ? values[stored.name] : undefined;
	return typeof value === "string" ? value : "";
}

/** 비어 있으면 발행할 때 본문 앞부분으로 채우는 필드(`fillFromBody`). */
export function fillFromBodyFields(collection: SchemaCollection): (StoredField & { readonly field: TextField })[] {
	return storedFields(collection).filter(
		(stored): stored is StoredField & { readonly field: TextField } =>
			stored.field.kind === "text" && Boolean(stored.field.fillFromBody),
	);
}

/**
 * 주소 필드의 `from`이 가리키는 값으로 만든 주소. `from`이 없거나 값이 비면 `""`(자동으로 만들지 않는다).
 */
export function slugFromValues(collection: SchemaCollection, values: { readonly [key: string]: unknown }): string {
	const from = slugFieldOf(collection)?.from;
	const source = from ? values[from] : undefined;
	return typeof source === "string" ? slugify(source) : "";
}

/** 필드 이름 → 저장 형식. v1 `COLLECTION_DEFINITIONS.fields`와 같은 모양이다. */
export function storageTypes(collection: SchemaCollection): Record<string, StorageType> {
	return Object.fromEntries(storedFields(collection).map(({ name, field }) => [name, storageTypeOf(field)]));
}

/** 관계 필드 목록. v1 `COLLECTION_DEFINITIONS.relations`와 같은 모양이다. */
export function relationsOf(collection: SchemaCollection): { field: string; kind: "entry"; to: RelationTarget }[] {
	return storedFields(collection).flatMap(({ name, field }) =>
		field.kind === "relation" ? [{ field: name, kind: "entry" as const, to: field.to as RelationTarget }] : [],
	);
}

/**
 * 저장 형식 검사를 통과한 값의 의미를 검사한다. 문제가 있으면 v1 API의 오류 코드를 돌려준다.
 */
export function fieldValueError(field: ValueField, value: string | readonly string[]): string | null {
	const values = typeof value === "string" ? [value] : value;
	switch (field.kind) {
		case "text":
			if (field.max !== undefined && values.some((item) => Array.from(item).length > (field.max ?? 0))) {
				return "field_too_long";
			}
			return null;
		case "select":
			return values.every((item) => Object.hasOwn(field.options, item)) ? null : "invalid_metadata_value";
		case "relation":
			return values.every((item) => isUuid(item)) ? null : "invalid_metadata_value";
		case "media":
			// 비운 값(`""`)은 고르지 않은 것이다.
			return values.every((item) => item === "" || isUuid(item)) ? null : "invalid_metadata_value";
	}
}

export type MetadataReference = {
	/**
	 * 관계 필드는 콘텐츠(`entry`)를, 미디어 필드는 미디어(`media`)를 가리킨다. 콘텐츠의 대상 컬렉션은 필드 정의
	 * (`relationRule`)가 정한다.
	 */
	kind: "entry" | "media";
	targetId: string;
	path: string;
	ordinal?: number;
};

/**
 * 메타데이터 관계·미디어 필드의 참조를 선언 순서대로 모은다. 여러 개인 필드는 순서와 중복을 보존한다.
 * 조건이 맞지 않는 딸린 필드도 값이 있으면 모은다(저장된 값은 모두 추적한다). 미디어 참조는 미디어 사용처·
 * "사용하지 않음" 거르기·쓰고 있는 파일 삭제 막기에 쓰인다.
 */
export function metadataReferences(
	collection: SchemaCollection,
	metadata: { readonly [key: string]: unknown },
): MetadataReference[] {
	const references: MetadataReference[] = [];
	for (const { name, field } of storedFields(collection)) {
		if (field.kind !== "relation" && field.kind !== "media") continue;
		const kind = field.kind === "media" ? "media" : "entry";
		const value = metadata[name];
		if (value === "") continue;
		if (typeof value === "string") references.push({ kind, targetId: value, path: name });
		else if (Array.isArray(value)) {
			value.forEach((id, ordinal) => {
				if (typeof id === "string") references.push({ kind, targetId: id, path: name, ordinal });
			});
		}
	}
	return references;
}

/** 관계 필드가 기대하는 대상 컬렉션과 미공개 대상 허용 여부. */
export function relationRule(
	collection: SchemaCollection,
	path: string,
): { to: RelationTarget; allowUnpublished: boolean } | undefined {
	const stored = storedField(collection, path);
	if (stored?.field.kind !== "relation") return undefined;
	return { to: stored.field.to as RelationTarget, allowUnpublished: stored.field.allowUnpublished === true };
}

/**
 * 필수값 문제 코드. 주소 필드는 `null_slug`, 나머지(제목 포함)는 `missing_field`이고 `path`에 필드 이름,
 * `message`에 필드 라벨을 담는다.
 */
const NULL_SLUG = "null_slug";

const isEmptyValue = (value: unknown) =>
	value === undefined ||
	value === null ||
	(typeof value === "string" && value === "") ||
	(Array.isArray(value) && value.length === 0);

/** 발행(항목 컬렉션은 저장) 때 비어 있으면 안 되는 필드(`required`)의 문제. */
export function missingRequiredIssues(
	collection: SchemaCollection,
	snapshot: { slug: string | null; metadata: { readonly [key: string]: unknown } },
	options: { localizedOnly?: boolean } = {},
): { code: string; path: string; message?: string }[] {
	const issues: { code: string; path: string; message?: string }[] = [];
	// 번역본은 언어별 값만 가지므로 공통 필수값(카테고리 등)은 원문에서 검사한다(v2 B4).
	const required = (field: Field) =>
		"required" in field && isRequiredField(field) && (!options.localizedOnly || Boolean(field.localized));
	for (const [name, field] of Object.entries(schemaOf(collection).fields)) {
		if (field.kind !== "slug" || !required(field)) continue;
		if (!snapshot.slug) issues.push({ code: NULL_SLUG, path: name });
	}
	for (const { name, field, when } of storedFields(collection)) {
		if (!required(field)) continue;
		if (when && snapshot.metadata[when.field] !== when.value) continue;
		if (isEmptyValue(snapshot.metadata[name])) {
			issues.push({ code: "missing_field", path: name, message: field.label });
		}
	}
	return issues;
}

/** 언어별 값인 필드 이름(v2 B4). 표시가 없는 필드는 번역 묶음이 공통으로 쓴다. */
export function localizedFieldNames(collection: SchemaCollection): { own: string[]; inherit: string[] } {
	const own: string[] = [];
	const inherit: string[] = [];
	for (const [name, field] of Object.entries(schemaOf(collection).fields)) {
		if (field.kind === "backlink" || field.kind === "view") continue;
		if (field.localized === true) own.push(name);
		else if (field.localized === "inherit") inherit.push(name);
	}
	return { own, inherit };
}

/** 번역본이 가지면 안 되는 공통 필드 키(v2 B4). 정의에서 `localized`가 없는 저장 필드다. */
export function commonFieldKeys(collection: SchemaCollection, metadata: { readonly [key: string]: unknown }): string[] {
	const { own, inherit } = localizedFieldNames(collection);
	const localized = new Set([...own, ...inherit]);
	return Object.keys(metadata).filter((key) => !localized.has(key));
}

/** 원문 메타데이터에서 번역본으로 옮길 언어별 값만 고른다. */
export function pickLocalizedMetadata<T>(
	collection: SchemaCollection,
	metadata: { readonly [key: string]: T },
): Record<string, T> {
	const { own, inherit } = localizedFieldNames(collection);
	const localized = new Set([...own, ...inherit]);
	return Object.fromEntries(Object.entries(metadata).filter(([key]) => localized.has(key)));
}

/** 번역본 공개 메타데이터 = 원문의 공통 값 + 번역본의 언어별 값. */
export function mergeTranslationMetadata<T>(
	collection: SchemaCollection,
	source: { readonly [key: string]: T },
	translation: { readonly [key: string]: T },
): Record<string, T> {
	const { own, inherit } = localizedFieldNames(collection);
	const localized = new Set([...own, ...inherit]);
	const common = Object.fromEntries(Object.entries(source).filter(([key]) => !localized.has(key)));
	return { ...common, ...translation };
}

/**
 * 항목 컬렉션(카테고리·태그·모음집)의 언어별 값을 담는 메타데이터 키(v2 B4). 필드 이름으로 쓸 수 없다(`defineConfig`).
 * `{ en: { title: "..." }, ja: { ... } }`. 주소와 연결 관계는 공통이라 레코드는 언어마다 나누지 않는다.
 */
export const RECORD_TRANSLATIONS_KEY = RESERVED_METADATA_KEYS[0] as "translations";

export type RecordTranslations = { readonly [locale: string]: { readonly [field: string]: string } };

/** 언어별 값을 가질 수 있는 항목 컬렉션의 텍스트 필드. */
export function recordLocalizedFields(collection: SchemaCollection): string[] {
	const schema = schemaOf(collection);
	if (schema.kind !== "item") return [];
	return Object.entries(schema.fields)
		.filter(([, field]) => field.kind === "text" && field.localized === true)
		.map(([name]) => name);
}

/**
 * record 언어별 값을 검사하고 정리한다. 기본 언어가 아닌 언어와 정의의 언어별 텍스트 필드만 받는다.
 * 빈 값과 빈 언어는 지운다. 잘못된 모양이면 v1 오류 코드를 던질 수 있게 `error`를 돌려준다.
 */
export function normalizeRecordTranslations(
	collection: SchemaCollection,
	value: unknown,
	locales: readonly string[],
): { value: RecordTranslations } | { error: string; path?: string; label?: string } {
	const fieldsAllowed = recordLocalizedFields(collection);
	const isPlain = (item: unknown): item is Record<string, unknown> =>
		typeof item === "object" &&
		item !== null &&
		!Array.isArray(item) &&
		(Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null);
	if (fieldsAllowed.length === 0) return { error: "invalid_metadata_key" };
	if (!isPlain(value)) return { error: "invalid_metadata_type" };
	const result: Record<string, Record<string, string>> = {};
	for (const [locale, values] of Object.entries(value)) {
		if (!locales.includes(locale)) return { error: "invalid_metadata_value" };
		if (!isPlain(values)) return { error: "invalid_metadata_type" };
		const cleaned: Record<string, string> = {};
		for (const [name, text] of Object.entries(values)) {
			const field = storedField(collection, name)?.field;
			if (!fieldsAllowed.includes(name) || field?.kind !== "text") return { error: "invalid_metadata_key" };
			if (typeof text !== "string") return { error: "invalid_metadata_type" };
			const error = fieldValueError(field, text);
			if (error) return { error, path: `${RECORD_TRANSLATIONS_KEY}.${locale}.${name}`, label: field.label };
			if (text.trim()) cleaned[name] = text.trim();
		}
		if (Object.keys(cleaned).length > 0) result[locale] = cleaned;
	}
	return { value: result };
}
