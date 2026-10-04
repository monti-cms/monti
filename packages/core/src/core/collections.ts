import { cmsConfig } from "../config/resolved";
import type { CollectionKind } from "../schema/collection";
import {
	relationsOf,
	type SchemaCollection,
	type StoredField,
	schemaOf,
	storageTypes,
	storedFields,
} from "../schema/derive";
import type { StorageType } from "../schema/fields";

/** 컬렉션 이름(`cms.config.ts`의 `collections` 키). 선언 순서를 따른다. */
export type Collection = SchemaCollection;
export const COLLECTIONS = Object.keys(cmsConfig.collections) as readonly Collection[];

export type { CollectionKind, CollectionWorkflow } from "../schema/collection";

export type FieldType = StorageType;

export interface CollectionRelation {
	readonly field: string;
	readonly kind: "entry";
}

/** v1 모양의 컬렉션 요약. 필드·관계는 사이트 설정(`cms.config.ts`)의 정의에서 만든다(v2 B1). */
export interface CollectionDefinition {
	readonly name: Collection;
	readonly label: string;
	readonly kind: CollectionKind;
	readonly fields: Readonly<Record<string, FieldType>>;
	readonly relations?: readonly CollectionRelation[];
}

export const COLLECTION_DEFINITIONS: Readonly<Record<Collection, CollectionDefinition>> = Object.fromEntries(
	COLLECTIONS.map((name) => {
		const schema = schemaOf(name);
		const relations = relationsOf(name).map(({ field, kind }) => ({ field, kind }));
		return [
			name,
			{
				name,
				label: schema.label,
				kind: schema.kind,
				fields: storageTypes(name),
				...(relations.length > 0 ? { relations } : {}),
			},
		];
	}),
) as Record<Collection, CollectionDefinition>;

export function isCollection(val: unknown): val is Collection {
	return typeof val === "string" && (COLLECTIONS as readonly string[]).includes(val);
}

/** 명시적 저장이 곧 공개 반영인 항목 컬렉션(`kind: "item"`, 예: 태그)인가. */
export function isItemCollection(val: unknown): boolean {
	return isCollection(val) && COLLECTION_DEFINITIONS[val].kind === "item";
}

/** 초안과 발행을 나누는 문서 컬렉션(`kind: "document"`, 예: 게시글)인가. */
export const isDocumentCollection = (val: unknown): val is Collection =>
	isCollection(val) && COLLECTION_DEFINITIONS[val].kind === "document";

/** 문서 컬렉션(`kind: "document"`). */
export const DOCUMENT_COLLECTIONS = COLLECTIONS.filter((c) => COLLECTION_DEFINITIONS[c].kind === "document");

/** @deprecated `isItemCollection`. */
export const isRecordCollection = isItemCollection;
/** @deprecated `DOCUMENT_COLLECTIONS`. */
export const CONTENT_COLLECTIONS = DOCUMENT_COLLECTIONS;
/** @deprecated `isDocumentCollection`. */
export const isContentCollection = isDocumentCollection;

/** 주소에 컬렉션이 없을 때 여는 컬렉션. 첫 콘텐츠 컬렉션, 없으면 첫 컬렉션. */
export const DEFAULT_COLLECTION: Collection = (DOCUMENT_COLLECTIONS[0] ?? COLLECTIONS[0]) as Collection;

/**
 * 분류 필드: 항목 컬렉션(`kind: "item"`)을 가리키는 관계 필드(예: 태그·카테고리). 목록의 열·필터, 일괄 작업,
 * 행 메뉴가 이 필드에서 만들어진다. 콘텐츠를 가리키는 관계(대체 글·모음집 글 목록 등)는 빠진다.
 */
export function taxonomyFieldsOf(collection: string): Array<StoredField & { readonly to: Collection }> {
	if (!isCollection(collection)) return [];
	return storedFields(collection).flatMap((stored) =>
		stored.field.kind === "relation" && isItemCollection(stored.field.to)
			? [{ ...stored, to: stored.field.to as Collection }]
			: [],
	);
}
