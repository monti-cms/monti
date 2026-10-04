/**
 * 컬렉션 필드 빌더(v2 B1). Keystatic의 `fields.*`처럼 코드 한 곳에서 필드를 정의한다.
 *
 * 필드 정의는 서버와 브라우저가 함께 쓰므로 **JSON으로 직렬화할 수 있는 값만** 가진다.
 * 함수·React 컴포넌트·비밀 값을 넣지 않는다. 입력 교체(`input`)는 이름으로만 가리키고 실제 구현은 클라이언트
 * 입력 등록부에 둔다. 입력 옆 AI 버튼은 필드 정의가 아니라 화면 자리(`src/cms/slots`)가 필드 이름으로 붙인다(v2 D).
 */

/**
 * 언어별 값인가(v2 B4). `true`는 언어마다 따로 가지고, `"inherit"`는 원문 값을 기본으로 물려받되 바꿀 수 있다.
 * 표시가 없으면 번역 묶음이 공통으로 쓴다.
 */
export type Localized = boolean | "inherit";

/**
 * 필드의 뜻(역할). 확장·화면은 필드 이름이 아니라 역할로 값을 찾는다. 한 컬렉션에서 역할마다
 * 필드는 하나뿐이다(`defineConfig`가 확인한다). 역할 이름과 맞는 필드 종류는 그 역할을 쓰는 확장이 정하고 확인한다
 * (플러그인 `validate`).
 *
 * 본체가 아는 역할은 `summary`(요약, 텍스트 필드) 하나다. 필드 옆 동작(AI 등)에 `summary`로 넘어가고 목록·검색 결과
 * 설명의 기본값이다.
 */
export type FieldRole = string;
export const SUMMARY_ROLE = "summary";

interface BaseField {
	readonly label: string;
	/** 입력 아래 도움말. */
	readonly description?: string;
	/**
	 * 비어 있으면 안 되는 필드. 문서(`document`) 컬렉션은 발행할 때, 항목(`item`) 컬렉션은 저장할 때 검사한다.
	 * 초안 저장은 막지 않는다. 예전 값 `"publish"`도 같은 뜻으로 받는다.
	 */
	readonly required?: true | "publish";
	readonly localized?: Localized;
	/** 기본 입력 대신 쓸 클라이언트 입력 등록부의 이름. */
	readonly input?: string;
	/**
	 * 기본 입력이나 `input`이 가리키는 입력에 넘길 설정(예: 권장 글자 수). 본체는 읽지 않는다. JSON 값만 둔다.
	 */
	readonly inputOptions?: Readonly<Record<string, string | number | boolean>>;
	/** 저장·검증만 하고 속성 패널에 입력을 그리지 않는다. 저장된 값은 그대로 둔다. */
	readonly hidden?: boolean;
	/** 필드의 뜻(`FieldRole`). 컬렉션 안에서 겹치지 않는다. */
	readonly role?: FieldRole;
	/**
	 * 편집 화면 속성 칸에서 이 필드를 그릴 탭 이름. 배치(`layout`) 묶음의 `tab`이 있으면 그것이 먼저다. 확장이 주는 필드 묶음
	 * 이 사이트가 배치를 적지 않아도 제 탭에 모이게 한다. 없으면 기본 탭(`속성`)이다.
	 */
	readonly tab?: string;
}

export interface TextField extends BaseField {
	readonly kind: "text";
	/**
	 * 발행할 때 비어 있으면 본문 앞부분의 일반 글자로 채운다. `true`면 160자, `{ maxLength }`로 바꾼다.
	 * 본문이 있는 컬렉션에서만 쓴다. 채울 글이 없으면 발행하지 않고 이 필드를 입력하라고 알린다.
	 */
	readonly fillFromBody?: boolean | { readonly maxLength?: number };
	readonly multiline?: boolean;
	/** 여러 줄 입력(`multiline`)의 처음 줄 수. 없으면 2줄. */
	readonly rows?: number;
	/** 최대 글자 수(유니코드 코드 포인트). */
	readonly max?: number;
	readonly placeholder?: string;
}

/** 주소. 메타데이터가 아니라 콘텐츠의 slug 열에 저장한다. */
export interface SlugField extends BaseField {
	readonly kind: "slug";
	/**
	 * 주소를 만들 때 읽는 텍스트 필드 이름(보통 `title`). 다시 만들기 단추와 자동 생성(새 글 입력 중, record 저장 때
	 * 비어 있으면)이 이 필드 값을 쓴다. 없으면 주소를 자동으로 만들지 않는다.
	 */
	readonly from?: string;
	readonly placeholder?: string;
}

export interface RelationField extends BaseField {
	readonly kind: "relation";
	/** 관계 대상 컬렉션 이름. 실제로 있는 컬렉션인지는 `defineConfig`가 확인한다. */
	readonly to: string;
	readonly many?: boolean;
	/** 없는 대상을 입력 옆에서 바로 만든다(v2 B2). */
	readonly createInline?: boolean;
	/** 고를 때 공개된 대상만 보여 준다. */
	readonly publishedOnly?: boolean;
	/** 공개되지 않은 대상도 발행을 막지 않는다(모음집 항목, v1 §6.4). */
	readonly allowUnpublished?: boolean;
	/** 여러 개일 때 순서를 사용자가 정한다. */
	readonly ordered?: boolean;
	readonly placeholder?: string;
}

export interface SelectField<Option extends string = string> extends BaseField {
	readonly kind: "select";
	/** 값 → 라벨. 선언 순서가 보이는 순서다. */
	readonly options: Readonly<Record<Option, string>>;
	readonly defaultValue: Option;
}

/**
 * 미디어 라이브러리의 파일 하나(미디어 ID를 글자로 저장한다). 관리자 화면은 미디어 고르기로 입력하고, 값은 미디어
 * 사용처(`entry_references`)에 잡혀 쓰고 있는 파일은 지울 수 없다.
 */
export interface MediaField extends BaseField {
	readonly kind: "media";
	/** 고를 수 있는 파일. `image`면 이미지만, `file`이면 아무 파일. 없으면 `image`. */
	readonly accept?: "image" | "file";
	readonly placeholder?: string;
}

/**
 * 선택 값에 따라 딸린 필드가 생기는 필드. 선택 값은 이 필드 이름으로, 딸린 필드는 각자 이름으로
 * 메타데이터 최상위에 저장한다(v1 저장 형식 유지). 딸린 값은 조건이 맞을 때만 남긴다.
 */
export interface ConditionalField<Option extends string = string> extends Omit<BaseField, "label" | "required"> {
	readonly kind: "conditional";
	readonly label: string;
	readonly discriminant: SelectField<Option>;
	readonly values: { readonly [K in Option]?: Readonly<Record<string, ValueField>> };
}

/**
 * 반대 방향 관계(v2 B2). 이 콘텐츠에는 저장하지 않고, 다른 컬렉션(`from`)의 여러 개 관계 필드(`via`)가
 * 이 콘텐츠를 가리키는지를 보여 주고 바꾼다. 예: 게시글 속성 패널의 `모음집`은 모음집의 `itemIds`를 편집한다.
 * 입력은 누르는 즉시 상대 레코드에 저장한다(이 콘텐츠의 초안·발행과 별개).
 */
export interface BacklinkField extends Omit<BaseField, "required" | "localized"> {
	readonly kind: "backlink";
	/** 관계 필드를 가진 상대 컬렉션 이름. */
	readonly from: string;
	readonly via: string;
	/** 없는 대상을 이 콘텐츠를 담은 채로 바로 만든다. */
	readonly createInline?: boolean;
	readonly placeholder?: string;
	readonly localized?: undefined;
	readonly required?: undefined;
}

/**
 * 보기 필드. 값을 저장하지 않고 편집 화면 속성 칸의 그 자리에 화면 하나를 그린다(예: 검색 결과·공유 미리보기).
 * `view`는 관리자 확장의 `fieldViews`에 등록한 이름이다. 등록한 화면이 없으면 아무것도 그리지 않는다.
 */
export interface ViewField {
	readonly kind: "view";
	readonly view: string;
	/** 화면 위 이름. 없으면 이름 없이 그린다. */
	readonly label?: string;
	readonly description?: string;
	readonly hidden?: boolean;
	/** 그릴 탭(`BaseField.tab`과 같다). */
	readonly tab?: string;
	readonly localized?: undefined;
	readonly required?: undefined;
	readonly input?: undefined;
}

/**
 * 메타데이터에서 본체가 따로 쓰는 키. 필드 이름으로 쓸 수 없다(`defineConfig`가 막는다).
 * `translations`는 항목 컬렉션의 언어별 값이다.
 */
export const RESERVED_METADATA_KEYS: readonly string[] = ["translations"];

/** 필드가 비어 있으면 안 되는가(`required: true`·예전 값 `"publish"`). */
export const isRequiredField = (field: { readonly required?: true | "publish" }): boolean =>
	field.required === true || field.required === "publish";

/** 본문에서 채울 때의 기본 글자 수. */
export const FILL_FROM_BODY_MAX_LENGTH = 160;

/**
 * 본문에서 채우는 필드의 글자 수(`fillFromBody`). 필드 `max`보다 길지 않다. 채우지 않는 필드면 `undefined`.
 */
export function fillFromBodyLength(field: TextField): number | undefined {
	const fill = field.fillFromBody;
	if (!fill) return undefined;
	const length = fill === true ? FILL_FROM_BODY_MAX_LENGTH : (fill.maxLength ?? FILL_FROM_BODY_MAX_LENGTH);
	return field.max === undefined ? length : Math.min(length, field.max);
}

/** 값 하나를 저장하는 필드. */
export type ValueField = TextField | RelationField | SelectField | MediaField;
export type Field = ValueField | SlugField | ConditionalField | BacklinkField | ViewField;
export type FieldKind = Field["kind"];

type Options<F extends { kind: string }> = Omit<F, "kind">;

export const fields = {
	text: <const O extends Options<TextField>>(options: O) => ({ kind: "text", ...options }) as const,
	slug: <const O extends Options<SlugField>>(options: O) => ({ kind: "slug", ...options }) as const,
	relation: <const O extends Options<RelationField>>(options: O) => ({ kind: "relation", ...options }) as const,
	backlink: <const O extends Options<BacklinkField>>(options: O) => ({ kind: "backlink", ...options }) as const,
	view: <const O extends Options<ViewField>>(options: O) => ({ kind: "view", ...options }) as const,
	select: <const O extends Options<SelectField>>(options: O) => ({ kind: "select", ...options }) as const,
	media: <const O extends Options<MediaField>>(options: O) => ({ kind: "media", ...options }) as const,
	conditional: <const D extends SelectField, const V extends ConditionalField["values"]>(discriminant: D, values: V) =>
		({
			kind: "conditional",
			label: discriminant.label,
			...(discriminant.description ? { description: discriminant.description } : {}),
			discriminant,
			values,
		}) as const,
};

/** 필드 값의 저장 형식. */
export type StorageType = "string" | "string[]";

export const storageTypeOf = (field: ValueField): StorageType =>
	field.kind === "relation" && field.many ? "string[]" : "string";

/** 저장 값의 TypeScript 타입. */
export type ValueOf<F> = F extends RelationField
	? F["many"] extends true
		? readonly string[]
		: string
	: F extends { readonly kind: "select"; readonly options: infer Options }
		? keyof Options & string
		: F extends TextField | MediaField
			? string
			: never;
