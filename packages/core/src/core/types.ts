import type { ResolvedConfig } from "../config/resolved";
import type { CmsImageSource } from "../mdx/types";
import type { MetadataOf } from "../schema/collection";
import type { RecordTranslations } from "../schema/derive";
import type { Collection } from "./collections";
import type { TranslationState } from "./translation/state";

/**
 * CMS 도메인 타입. 저장소 구현·서비스·HTTP 계층이 함께 쓰며 어떤 계층에도 의존하지 않는다.
 */

export type Issue = {
	readonly code: string;
	/**
	 * 사이트 화면 언어의 안내. 코드·`params`에서 `cms.core` 사전으로 만들거나(표 검사), 대상 이름(속성 이름·주소·파서 오류)을
	 * 담는다. 화면은 코드로 문구를 고르고 `message`는 덧붙인다.
	 */
	readonly message?: string;
	/** 같은 코드 안의 갈래(`reason`)와 문구의 값 자리를 채우는 값. */
	readonly params?: Readonly<Record<string, string | number>>;
	/** 본문 문제의 위치. */
	readonly position?: { readonly line: number; readonly column: number };
	/** 메타데이터 문제의 필드 경로. */
	readonly path?: string;
	readonly ordinal?: number;
};

export type { Collection };
/**
 * 참조 대상 종류. 콘텐츠(`entry`)의 컬렉션은 관계 필드 정의가 정한다.
 * 예전에 저장한 `category`·`tag` 참조는 읽을 때 `entry`로 바꾼다(`normalizeReferenceKind`).
 */
export type ReferenceKind = "entry" | "media";

export const normalizeReferenceKind = (kind: string): ReferenceKind => (kind === "media" ? "media" : "entry");

export type ReferenceOccurrence =
	| { readonly type: "mdx"; readonly line: number; readonly column: number }
	| { readonly type: "metadata"; readonly path: string; readonly ordinal?: number };

export type Reference = {
	readonly kind: ReferenceKind;
	readonly targetId: string;
	readonly isStale: boolean;
	readonly occurrences: readonly ReferenceOccurrence[];
};

/** 저장 메타데이터 값. record 컬렉션의 언어별 값(`translations`)만 객체다(v2 B4). */
export type MetadataValue =
	| string
	| readonly string[]
	| { readonly [locale: string]: { readonly [field: string]: string } };

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

type SCHEMAS = ResolvedConfig["collections"];
/** 항목 컬렉션은 언어별 이름을 `translations`에 둔다(v2 B4). */
type WithRecordTranslations<S, M> = S extends { readonly kind: "item" } ? M & { translations?: RecordTranslations } : M;
/** 컬렉션의 메타데이터. 사이트 설정(`cms.config.ts`)의 정의에서 만든다(v2 B1). */
export type MetadataFor<C extends Collection> = WithRecordTranslations<SCHEMAS[C], MetadataOf<SCHEMAS[C]>>;

type InputFor<C extends Collection, M> = {
	collection: C;
	slug: string | null;
	metadata: M;
	mdx: string;
	folderId?: string | null;
	/** 번역본의 번역 상태(v3). 생략하면 저장된 값을 그대로 둔다. 원문은 `null`만 받는다. */
	translation?: TranslationState | null;
};

export type ServiceInput = { [C in Collection]: InputFor<C, MetadataFor<C>> }[Collection];

export type SaveDraftInput = ServiceInput & { expectedVersion: number };

export type InternalLinkSource = {
	/** 링크가 가리키는 컬렉션(`path`가 있는 컬렉션). */
	readonly collection: Collection;
	readonly slug: string;
	readonly url: string;
	readonly position: { readonly line: number; readonly column: number };
};

export type ResolvedInternalLink = {
	readonly collection: Collection;
	readonly slug: string;
	readonly addressType: "current" | "alias" | "reservation" | "deleted" | "missing";
	readonly isPublished: boolean;
};

export type PreparedSnapshot = {
	readonly collection: Collection;
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: MetadataValue };
	readonly mdx: string;
	readonly schemaVersion: number;
	readonly contentHash: string;
	readonly references: readonly Reference[];
	/** 발행을 막는 문제. 초안 저장은 막지 않는다. */
	readonly issues: readonly Issue[];
	/** 발행을 막지 않는 안내(정의에 없는 블록 속성 등). */
	readonly warnings?: readonly Issue[];
	readonly internalLinks?: readonly InternalLinkSource[];
	/** 본문 이미지 소스와 위치. 발행 전 검사가 비차단 경고를 만들 때 쓴다. */
	readonly imageSources: readonly CmsImageSource[];
	/** 번역본의 번역 상태(v3). `undefined`면 저장된 값을 유지한다. 내용 해시에는 넣지 않는다. */
	readonly translation?: TranslationState | null;
};

export type ResolvedTargets = {
	targets: { id: string; isPublished: boolean; collection: string }[];
	/**
	 * 발행 전 검사의 이미지 경고가 미디어 상태를 본다.
	 * `status`·`storageKey`는 선택이다 — 호출자가 안 채우면 그 경고만 건너뛴다(차단하지 않는다).
	 */
	media: { id: string; status?: string; storageKey?: string | null }[];
	internalLinks?: ResolvedInternalLink[];
	/**
	 * 번역본 발행이면 원문 상태(v2 B4). 번역본은 언어별 필수값만 검사하고, 공통 값을 가진 원문이 공개돼 있어야 한다.
	 */
	translation?: { sourcePublished: boolean };
};

export type WorkingCopy = {
	readonly collection: Collection;
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: unknown };
	readonly mdx: string;
	readonly version: number;
	readonly folderId: string | null;
	/** 콘텐츠 언어와 번역 묶음 ID(v2 B4). 원문이면 묶음 ID가 자기 ID다. */
	readonly locale?: string;
	readonly translationGroupId?: string;
};

export class ServiceError extends Error {
	constructor(
		public readonly code: string,
		public readonly issues?: readonly Issue[],
	) {
		super(code);
		this.name = "ServiceError";
	}
}
