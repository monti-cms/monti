import type { BacklinkField, Field, SlugField, ValueField, ValueOf } from "./fields";
import { valueFieldsOf } from "./walk";

/**
 * 컬렉션 종류(§5.2).
 *
 * - `document`(문서): 본문을 쓰고 초안과 공개본을 나눈다. 명시적 발행으로 공개한다(예: 게시글).
 * - `item`(항목): 작은 폼에서 저장하면 곧바로 현재 값(공개)에 반영한다. 발행·보관·번역본이 없다(예: 태그).
 */
export type CollectionKind = "document" | "item";

/**
 * 예전 이름(`workflow`). `publish`는 `document`, `record`는 `item`이다.
 * @deprecated `kind`를 쓴다. `defineCollection`이 아직 받아 `kind`로 바꾼다.
 */
export type CollectionWorkflow = "publish" | "record";

/** 예전 이름(`workflow`)의 종류. */
export type KindOfWorkflow<W extends CollectionWorkflow> = W extends "record" ? "item" : "document";

/** 예전 이름(`workflow`)을 종류(`kind`)로 바꾼다. */
export const kindOfWorkflow = (workflow: CollectionWorkflow): CollectionKind =>
	workflow === "record" ? "item" : "document";

/** 목록의 시스템 컬럼. 필드가 아니라 콘텐츠 자체의 값이다. */
export const SYSTEM_LIST_COLUMNS = ["status", "locale", "updatedAt", "createdAt", "publishedAt", "folder"] as const;
export type SystemListColumn = (typeof SYSTEM_LIST_COLUMNS)[number];

/**
 * 목록 컬럼(`list.columns`)이 쓸 수 있는 이름인지 확인한다. 시스템 컬럼, 저장하는 필드 이름(조건부 필드에 딸린 필드 포함),
 * 주소 필드 이름, 주소 필드가 있을 때의 `slug`만 된다. 모르는 이름이거나 저장하지 않는 필드(보기·반대 방향 관계)거나
 * 같은 이름을 두 번 적으면 오류다. `defineConfig`가 부른다.
 */
export function validateListColumns(
	collection: string,
	schema: Pick<CollectionSchema, "fields"> & { readonly list?: { readonly columns: readonly string[] } },
): void {
	const columns = schema.list?.columns;
	if (columns === undefined) return;
	if (!Array.isArray(columns))
		throw new Error(`cms.config: ${collection}.list.columns must be an array of column names`);
	const stored = new Set(valueFieldsOf(schema).map((field) => field.name));
	const slugFields = Object.entries(schema.fields).filter(([, field]) => field.kind === "slug");
	const system = new Set<string>(SYSTEM_LIST_COLUMNS);
	const seen = new Set<string>();
	for (const column of columns) {
		const at = `cms.config: ${collection}.list.columns`;
		if (typeof column !== "string") throw new Error(`${at} must be an array of column names`);
		const field = Object.hasOwn(schema.fields, column) ? schema.fields[column] : undefined;
		const known =
			system.has(column) ||
			stored.has(column) ||
			slugFields.some(([name]) => name === column) ||
			(column === "slug" && slugFields.length > 0);
		if (!known) {
			if (field)
				throw new Error(`${at} "${column}" is a ${field.kind} field that is not stored, so it cannot be a column`);
			throw new Error(
				`${at} has unknown column "${column}"; use a field name of ${collection} or one of: ${SYSTEM_LIST_COLUMNS.join(", ")}`,
			);
		}
		if (seen.has(column)) throw new Error(`${at} lists "${column}" twice`);
		seen.add(column);
	}
}

export interface LayoutGroup<Name extends string = string> {
	/** 속성 패널의 묶음 제목. 없으면 제목 없이 이어 그린다. */
	readonly group?: string;
	readonly fields: readonly Name[];
	/** 처음에 접어 둔다. */
	readonly collapsed?: boolean;
	/**
	 * 편집 화면 속성 칸에서 이 묶음을 그릴 탭 이름. 같은 이름의 묶음은 한 탭에 모이고, 없으면 기본 탭(`속성`)에 그린다.
	 */
	readonly tab?: string;
}

export interface CollectionSchema<
	Fields extends Readonly<Record<string, Field>> = Readonly<Record<string, Field>>,
	Kind extends CollectionKind = CollectionKind,
> {
	readonly label: string;
	/** 컬렉션 종류(`document`·`item`). */
	readonly kind: Kind;
	/** 본문(MDX)을 가지는가. 없으면 `document` 컬렉션만 본문을 쓴다. */
	readonly body: boolean;
	/**
	 * 필드 이름 → 정의. 꼭 `title` 텍스트 필드(`fields.text`)가 있어야 한다(`defineConfig`가 확인한다). 목록·검색·
	 * 관계 고르기·본문 링크·편집 화면 제목 칸이 이 필드를 쓴다.
	 */
	readonly fields: Fields;
	/**
	 * 공개 주소 모양(예: `/posts/:slug`). `:slug`를 꼭 한 번 쓴다. 본문의 내부 링크를 알아보고(발행 전 검사),
	 * 편집기가 링크를 만들 때 쓴다. 없으면 이 컬렉션은 본문 링크로 가리킬 수 없다.
	 */
	readonly path?: string;
	/**
	 * 관리자 사이드바 아이콘 이름(lucide, 예: `file-text`·`notebook-pen`·`tag`·`shapes`·`layers`·`folder`·`image`).
	 * 없거나 모르는 이름이면 종류에 맞는 기본 아이콘이다.
	 */
	readonly icon?: string;
	/**
	 * 속성 패널 배치. 적지 않은 필드는 마지막 묶음 뒤에 선언 순서대로 그린다. 없으면 필드 선언 순서대로 그리고,
	 * 제 `tab`을 가진 필드는 그 탭에 모인다.
	 */
	readonly layout?: readonly LayoutGroup[];
	/**
	 * 목록. 없으면 기본 컬럼이다: 문서는 제목·상태·언어(언어가 둘 이상일 때)·분류 필드(항목 컬렉션을 가리키는 관계)·
	 * 수정일·발행일, 항목은 제목·주소·언어·상태·수정일.
	 */
	readonly list?: {
		/**
		 * 목록이 보여 줄 컬럼과 그 순서. 필드 이름 또는 시스템 컬럼이다. 모르는 이름은 `defineConfig`가 오류로 알린다.
		 * 글자(`text`)·선택(`select`)·관계 필드는 기본 칸으로 그리고, 관리자 확장(`listCells`)이 칸 모양을 바꿀 수 있다.
		 */
		readonly columns: readonly string[];
	};
}

/** `defineCollection`이 받는 값(종류 말고). 배치·목록 컬럼에 적은 이름이 실제 필드인지 타입으로 확인한다. */
type CollectionInput<Fields extends Readonly<Record<string, Field>>> = Omit<
	CollectionSchema<Fields>,
	"kind" | "body" | "layout" | "list" | "path"
> & {
	path?: `/${string}:slug${string}`;
	body?: boolean;
	layout?: readonly LayoutGroup<Extract<keyof Fields, string>>[];
	list?: { columns: readonly (Extract<keyof Fields, string> | SystemListColumn)[] };
};

/** 컬렉션을 정의한다. 배치·목록 컬럼에 적은 이름이 실제 필드인지 타입으로 확인한다. */
export function defineCollection<
	const Fields extends Readonly<Record<string, Field>>,
	const Kind extends CollectionKind,
>(schema: CollectionInput<Fields> & { kind: Kind; workflow?: undefined }): CollectionSchema<Fields, Kind>;
/** @deprecated `workflow` 대신 `kind`를 쓴다(`publish` → `document`, `record` → `item`). */
export function defineCollection<
	const Fields extends Readonly<Record<string, Field>>,
	const Workflow extends CollectionWorkflow,
>(
	schema: CollectionInput<Fields> & { workflow: Workflow; kind?: undefined },
): CollectionSchema<Fields, KindOfWorkflow<Workflow>>;
export function defineCollection(
	schema: CollectionInput<Readonly<Record<string, Field>>> & { kind?: CollectionKind; workflow?: CollectionWorkflow },
): CollectionSchema {
	return normalizeCollection(schema);
}

/**
 * 컬렉션 정의를 정리한다: 예전 이름(`workflow`)을 종류(`kind`)로 바꾸고 본문 기본값(`document`만 본문)을 채운다.
 * `defineCollection`과 `defineConfig`가 부른다(이미 정리한 정의는 그대로다).
 */
export function normalizeCollection(
	schema: Omit<CollectionSchema, "kind" | "body"> & {
		readonly kind?: CollectionKind;
		readonly workflow?: CollectionWorkflow;
		readonly body?: boolean;
	},
): CollectionSchema {
	const { workflow, ...rest } = schema;
	const kind = schema.kind ?? (workflow ? kindOfWorkflow(workflow) : undefined);
	if (kind !== "document" && kind !== "item") {
		throw new Error(`cms.config: collection "${schema.label}" needs kind "document" or "item"`);
	}
	if (schema.kind !== undefined && workflow !== undefined && kindOfWorkflow(workflow) !== schema.kind) {
		throw new Error(`cms.config: collection "${schema.label}" has kind "${schema.kind}" and workflow "${workflow}"`);
	}
	return { ...rest, kind, body: schema.body ?? kind === "document" };
}

type Stored<Fields> = {
	[K in keyof Fields as Fields[K] extends SlugField | BacklinkField ? never : K]: Fields[K];
};

/** 조건부 필드에 딸린 필드를 최상위로 펼친다(저장 형식과 같다). */
type Nested<Fields> = {
	[K in keyof Fields]: Fields[K] extends { readonly kind: "conditional"; readonly values: infer V }
		? V[keyof V] extends infer Group
			? Group extends Readonly<Record<string, ValueField>>
				? Group
				: never
			: never
		: never;
}[keyof Fields];

type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void
	? I
	: never;

type FieldValue<F> = F extends { readonly kind: "conditional"; readonly discriminant: infer D }
	? ValueOf<D>
	: ValueOf<F>;

/**
 * 컬렉션 정의에서 만든 메타데이터 타입. 초안은 비어 있을 수 있으므로 모든 키가 선택이다.
 */
export type MetadataOf<S extends CollectionSchema> = {
	-readonly [K in keyof Stored<S["fields"]>]?: FieldValue<S["fields"][K]>;
} & {
	-readonly [K in keyof UnionToIntersection<Nested<S["fields"]>>]?: ValueOf<
		UnionToIntersection<Nested<S["fields"]>>[K]
	>;
};
