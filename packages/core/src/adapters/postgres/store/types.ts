import type { ListSortField } from "../../../core/api";
import type { TranslationState } from "../../../core/translation/state";
import type { ReferenceKind, ReferenceOccurrence } from "../../../core/types";

export type JsonPrimitive = string | number | boolean | null;
export interface JsonArray extends Array<JsonValue> {}
export interface JsonObject {
	[key: string]: JsonValue;
}
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type EntryMetadata = JsonObject;

export type EntryStatus = "draft" | "published" | "archived" | "trashed";

/** 공개 조회 전용 항목. 초안·보관·휴지통은 이 타입으로 표현되지 않는다. */
export interface PublishedEntryRecord {
	readonly id: string;
	readonly collection: string;
	/** 콘텐츠 언어(v2 B4). 번역본의 메타데이터는 원문의 공통 값과 합친 것이다. */
	readonly locale: string;
	readonly translationGroupId: string;
	readonly slug: string;
	readonly metadata: EntryMetadata;
	/** `includeBody: false`인 목록 조회에서는 빈 문자열이다. */
	readonly mdx: string;
	readonly publishedAt: Date | null;
	readonly updatedAt: Date;
}

/**
 * 공개 상세 조회 결과. `alias`는 과거 주소로 들어온 요청이며 `entry.slug`는 정규 current slug다.
 * 호출자는 `alias`를 308(영구 이동)으로 처리한다. `reservation`·`deleted` 주소와
 * current 주소가 없는 항목은 공개 계층에 존재하지 않으므로 `not_found`에 포함된다.
 */
export type PublishedEntryLookup =
	| { readonly status: "current"; readonly entry: PublishedEntryRecord }
	| { readonly status: "alias"; readonly entry: PublishedEntryRecord }
	| { readonly status: "not_found" };

export interface EntryBody {
	metadata: EntryMetadata;
	mdx: string;
	schemaVersion: number;
	contentHash: string;
	updatedAt: Date;
	/** 번역본의 번역 상태(v3 번역 화면). 원문과 예전 번역본은 `null`. */
	translation?: TranslationState | null;
}

export interface BodyTemplate {
	id: string;
	name: string;
	mdx: string;
	version: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface Entry {
	id: string;
	collection: string;
	/** 콘텐츠 언어(v2 B4). */
	locale: string;
	/** 번역 묶음 ID. 원문의 ID와 같고, 원문이면 자기 ID다. */
	translationGroupId: string;
	status: EntryStatus;
	version: number;
	folderId: string | null;
	createdAt: Date;
	updatedAt: Date;
	publishedAt?: Date;
	trashedAt?: Date;
	workingSlug: string | null;
	publishedSlug: string | null;
	working: EntryBody;
	published?: EntryBody;
}

/** 번역 묶음(v2 B4). `members`의 첫 항목이 원문이다. */
export interface TranslationGroup {
	groupId: string;
	members: {
		id: string;
		locale: string;
		status: EntryStatus;
		isSource: boolean;
		title: string | null;
		workingSlug: string | null;
	}[];
}

export interface MediaOriginalFile {
	storageKey: string | null;
	stagingKey: string | null;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
}

export interface MediaAssetRecord {
	id: string;
	status: "pending" | "ready" | "failed" | "deleting";
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	stagingKey: string | null;
	storageKey: string | null;
	/** 웹용으로 변환해 올린 경우의 원본 파일. 원본 유지 업로드는 `null`이다(§7.1). */
	original: MediaOriginalFile | null;
	defaultAlt: string;
	defaultCaption: string;
	createdAt: Date;
	updatedAt: Date;
	readyAt: Date | null;
}

export interface CreateMediaAssetInput {
	id?: string;
	filename: string;
	mimeType: string;
	byteSize: number;
	stagingKey: string;
	original?: { mimeType: string; byteSize: number; stagingKey: string };
}

export interface CompleteMediaAssetInput {
	id: string;
	storageKey: string;
	mimeType: string;
	byteSize: number;
	/** 첨부 파일(v3)은 크기가 없어 `null`이다. */
	width: number | null;
	height: number | null;
	original?: { storageKey: string; mimeType: string; byteSize: number; width: number; height: number };
}

export interface MediaReferenceItem {
	entryId: string;
	title: string | null;
	collection: string;
	state: "working" | "published";
}

export interface ListMediaItem extends MediaAssetRecord {
	referencesCount: number;
	references: MediaReferenceItem[];
}

export interface ListMediaParams {
	search?: string;
	mimeType?: string;
	/** 이미지만(`image`) 또는 이미지가 아닌 첨부 파일만(`file`). */
	kind?: "all" | "image" | "file";
	used?: "all" | "used" | "unused";
	uploadedFrom?: Date;
	uploadedTo?: Date;
	page?: number;
	pageSize?: number;
}

export interface ListMediaResult {
	items: ListMediaItem[];
	total: number;
	page: number;
	pageSize: number;
}

export interface Folder {
	id: string;
	collection: string;
	parentId: string | null;
	name: string;
	position: number;
	version: number;
}

export interface ListEntriesItem {
	id: string;
	collection: string;
	/** 콘텐츠 언어와 번역 묶음 ID(v2 B4). 공통 관계 값·표시 발행일은 원문 초안의 값이다. */
	locale: string;
	translationGroupId: string;
	title: string | null;
	slug: string | null;
	status: EntryStatus;
	version: number;
	folderId: string | null;
	/**
	 * 관계 필드 이름 → 고른 항목과 이름. 컬렉션의 모든 관계 필드를 담고(값이 없으면 빈 배열), 선언·고른 순서를 따른다.
	 * 이름을 찾지 못한 항목(지운 대상 등)은 `title: null`이다. 언어별이 아닌 관계는 원문 초안에서 읽는다(v2 B4).
	 */
	relations: Readonly<Record<string, readonly ListRelationValue[]>>;
	/**
	 * 필드 이름 → 글자로 저장된 값(글자·선택·미디어 필드). 목록의 필드 컬럼 기본 칸이 그린다. 값이 없는 필드는 빠진다.
	 * 언어별이 아닌 필드는 원문 초안에서 읽는다(v2 B4).
	 */
	values: Readonly<Record<string, string>>;
	/** 공개본이 있고 최신 초안이 공개본과 다르다(`발행됨 · 수정 중`). */
	hasUnpublishedChanges: boolean;
	publishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	trashedAt: Date | null;
	/**
	 * 묶음 보기(`groupTranslations`)에서만 채운다(v3 번역 화면). 같은 번역 묶음에서 휴지통 밖에 있는
	 * 콘텐츠(원문 포함)를 `LOCALES` 순서로 담는다.
	 */
	translations?: readonly ListTranslationMember[];
	/**
	 * record 컬렉션(카테고리·태그·모음집)에서만 채운다. 이름이 있는 언어를 `LOCALES` 순서로 담는다.
	 * 기본 언어는 항목 자체의 이름이고, 다른 언어는 `metadata.translations[언어].title`이다(v2 B4).
	 */
	recordLocales?: readonly string[];
}

/** 목록 줄의 관계 값 하나. */
export interface ListRelationValue {
	id: string;
	title: string | null;
}

/** 목록 한 줄(원문)에 딸린 같은 묶음의 언어별 콘텐츠. */
export interface ListTranslationMember {
	id: string;
	locale: string;
	status: EntryStatus;
	version: number;
	isSource: boolean;
	hasUnpublishedChanges: boolean;
}

export interface DateRange {
	from?: Date;
	to?: Date;
}

export interface ListEntriesParams {
	collection: string;
	search?: string;
	includeBody?: boolean;
	/** 컬럼 헤더 필터: 제목만(부분 일치). `search`와 AND로 함께 쓴다. */
	titleContains?: string;
	/** 컬럼 헤더 필터: 주소(slug)만(부분 일치). */
	slugContains?: string;
	statuses?: readonly EntryStatus[];
	/**
	 * 이 언어들만(v2 B4). 없으면 모든 언어다.
	 * 묶음 보기에서는 "이 언어 콘텐츠가 (휴지통 밖에) 있는 묶음"으로 거른다.
	 */
	locales?: readonly string[];
	/**
	 * 번역 묶음마다 원문 한 줄로 보인다(v3 번역 화면). 검색은 묶음 안 어느 언어 제목·주소에 걸려도 되고,
	 * 그 밖의 필터·정렬은 원문 값이다. 줄마다 `translations`를 채운다.
	 */
	groupTranslations?: boolean;
	folderId?: string | null;
	includeDescendants?: boolean;
	/** 관계 필드 이름 → 고른 항목 ID. 같은 필드의 여러 값은 OR, 다른 필드끼리는 AND다(§3.2). */
	relations?: Readonly<Record<string, readonly string[]>>;
	hasUnpublishedChanges?: boolean;
	createdAt?: DateRange;
	updatedAt?: DateRange;
	publishedAt?: DateRange;
	sort?: { field: ListSortField; direction: "asc" | "desc" };
	page?: number;
	pageSize?: 25 | 50 | 100;
}

export interface ListEntriesResult {
	items: ListEntriesItem[];
	total: number;
	page: number;
	pageSize: number;
}

export interface IncomingReferenceItem {
	state: "working" | "published";
	sourceId: string;
	sourceCollection: string;
	sourceTitle: string | null;
	sourceSlug: string | null;
	kind: ReferenceKind;
	isStale: boolean;
	occurrences: readonly ReferenceOccurrence[];
}

export interface ExportSnapshotBody {
	metadata: EntryMetadata;
	mdx: string;
	schemaVersion: number;
	contentHash: string;
	updatedAt: Date;
	/** 번역본의 번역 상태(v3). */
	translation?: TranslationState | null;
}

export interface ExportSnapshotEntry {
	id: string;
	collection: string;
	/** 콘텐츠 언어와 번역 묶음 ID(v2 B4). 원문이면 묶음 ID가 자기 ID다. */
	locale: string;
	translationGroupId: string;
	status: string;
	version: number;
	folderId: string | null;
	workingSlug: string | null;
	publishedSlug: string | null;
	createdAt: Date;
	updatedAt: Date;
	publishedAt: Date | null;
	working: ExportSnapshotBody;
	published?: ExportSnapshotBody;
}

export interface ExportSnapshotReference {
	entryId: string;
	state: string;
	kind: string;
	targetId: string;
	isStale: boolean;
	occurrences: unknown;
}

export interface ExportSnapshotAddress {
	collection: string;
	locale: string;
	slug: string;
	entryId: string | null;
	type: string;
}

/** 관리자 백업·공개 projection의 공통 원본. 단일 REPEATABLE READ READ ONLY 스냅샷이다. */
export interface ExportSnapshot {
	entries: ExportSnapshotEntry[];
	references: ExportSnapshotReference[];
	folders: Folder[];
	addresses: ExportSnapshotAddress[];
	media: MediaAssetRecord[];
	templates: BodyTemplate[];
	preferences: { userId: string; preferences: JsonObject; updatedAt: Date }[];
}
