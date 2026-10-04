import type { ListSortField } from "@monti-cms/core/client";
import {
	createTranslator,
	isCollection,
	isItemCollection,
	LOCALES,
	type StoredField,
	schemaOf,
	taxonomyFieldsOf,
	valueFieldsOf,
} from "@monti-cms/core/client";
import type { ListState } from "./list-state";
import { screensMessages } from "./messages";

const t = createTranslator(screensMessages);

/**
 * 관리자 목록 컬럼. 콘텐츠 자체의 값(시스템 컬럼)과 분류 필드(분류용 컬렉션을 가리키는 관계 필드, 예: 태그·카테고리)다.
 * 사용자 컬럼 설정(순서·표시·너비)에 이 이름으로 저장한다. 분류 필드 컬럼의 이름은 필드 이름이다.
 */
export const SYSTEM_COLUMNS = [
	"title",
	"status",
	"locale",
	"updatedAt",
	"publishedAt",
	"createdAt",
	"slug",
	"folder",
] as const;
type SystemColumn = (typeof SYSTEM_COLUMNS)[number];
export type AdminListColumn = string;

type DateFromKey = "createdFrom" | "updatedFrom" | "publishedFrom";
type DateToKey = "createdTo" | "updatedTo" | "publishedTo";

/** 컬럼 헤더 팝업이 보여 줄 필터 종류(v2 A1). `relation`은 분류 필드(값은 분류 항목 ID)다. */
export type ColumnFilter =
	| { kind: "text"; key: "titleContains" | "slugContains"; placeholder: string }
	| { kind: "status" }
	| { kind: "locale" }
	| { kind: "relation"; field: string; collection: string }
	| { kind: "date"; from: DateFromKey; to: DateToKey }
	| { kind: "none" };

export interface ColumnConfig {
	label: string;
	sortField?: ListSortField;
	filter: ColumnFilter;
	/** 여러 개 관계(태그 등)의 컬럼. 칩으로 그리고 폭이 모자라면 먼저 숨긴다. */
	many?: boolean;
}

/** 시스템 컬럼의 라벨·정렬·필터. */
const SYSTEM_CONFIG: Record<SystemColumn, ColumnConfig> = {
	title: {
		label: t("column.title"),
		sortField: "title",
		filter: { kind: "text", key: "titleContains", placeholder: t("column.titlePlaceholder") },
	},
	status: { label: t("column.status"), filter: { kind: "status" } },
	locale: { label: t("column.locale"), filter: { kind: "locale" } },
	updatedAt: {
		label: t("column.updatedAt"),
		sortField: "updatedAt",
		filter: { kind: "date", from: "updatedFrom", to: "updatedTo" },
	},
	publishedAt: {
		label: t("column.publishedAt"),
		sortField: "publishedAt",
		filter: { kind: "date", from: "publishedFrom", to: "publishedTo" },
	},
	createdAt: {
		label: t("column.createdAt"),
		sortField: "createdAt",
		filter: { kind: "date", from: "createdFrom", to: "createdTo" },
	},
	slug: {
		label: t("column.slug"),
		sortField: "slug",
		filter: { kind: "text", key: "slugContains", placeholder: t("column.slugPlaceholder") },
	},
	// 폴더는 사이드바 탐색으로 거른다.
	folder: { label: t("column.folder"), filter: { kind: "none" } },
};

const isSystemColumn = (column: string): column is SystemColumn => Object.hasOwn(SYSTEM_CONFIG, column);

/**
 * 필드 컬럼의 필드: 시스템 컬럼이 아닌 이름의 저장 필드(글자·선택·미디어·관계). 분류 필드도 여기에 든다.
 * 없는 이름이거나 저장하지 않는 필드면 `undefined`.
 */
export function fieldColumnOf(collection: string, column: AdminListColumn): StoredField | undefined {
	if (isSystemColumn(column) || !isCollection(collection)) return undefined;
	return valueFieldsOf(schemaOf(collection)).find((stored) => stored.name === column);
}

/**
 * 컬럼 하나의 라벨·정렬·필터. 분류 필드는 필드 이름표가 라벨이고 필드가 가리키는 컬렉션 항목으로 거른다.
 * 그 밖의 필드 컬럼도 이름표가 라벨이고 거르지 않는다.
 */
export function columnConfig(collection: string, column: AdminListColumn): ColumnConfig {
	if (isSystemColumn(column)) return SYSTEM_CONFIG[column];
	const taxonomy = taxonomyFieldsOf(collection).find((stored) => stored.name === column);
	if (taxonomy?.field.kind === "relation") {
		return {
			label: taxonomy.field.label,
			filter: { kind: "relation", field: column, collection: taxonomy.to },
			many: taxonomy.field.many === true,
		};
	}
	const stored = fieldColumnOf(collection, column);
	if (!stored) return { label: column, filter: { kind: "none" } };
	return {
		label: stored.field.label,
		filter: { kind: "none" },
		...(stored.field.kind === "relation" && stored.field.many ? { many: true } : {}),
	};
}

export const columnLabel = (collection: string, column: AdminListColumn) => columnConfig(collection, column).label;

/**
 * 목록 설정(`list.columns`)이 없을 때의 기본 컬럼. 문서 컬렉션은 제목·상태·언어·분류 필드·수정일·발행일, 항목 컬렉션은
 * 제목·주소·언어·상태·수정일이다. 언어 컬럼은 언어가 둘 이상일 때만, 주소 컬럼은 주소 필드가 있을 때만 둔다.
 */
export function defaultListColumns(collection: string): AdminListColumn[] {
	if (!isCollection(collection)) return ["title", "status"];
	const schema = schemaOf(collection);
	const locale = LOCALES.length > 1 ? ["locale"] : [];
	if (schema.kind === "item") {
		const slug = Object.values(schema.fields).some((field) => field.kind === "slug") ? ["slug"] : [];
		return ["title", ...slug, ...locale, "status", "updatedAt"];
	}
	const taxonomy = taxonomyFieldsOf(collection).map((stored) => stored.name);
	return ["title", "status", ...locale, ...taxonomy, "updatedAt", "publishedAt"];
}

/**
 * 컬렉션에서 쓸 수 있는 컬럼과 기본 표시(§3.2). 컬렉션 정의(v2 B1)의 필드와 `list.columns`(없으면 기본 컬럼)에서 만든다.
 * 시스템 컬럼과 분류 필드 말고 `list.columns`에 적은 필드(글자·선택·관계 등)도 컬럼으로 쓸 수 있다.
 */
export function columnsFor(collection: string): { available: AdminListColumn[]; defaults: AdminListColumn[] } {
	if (!isCollection(collection)) return { available: [...SYSTEM_COLUMNS], defaults: ["title", "status"] };
	const schema = schemaOf(collection);
	// 주소 열은 이름과 상관없이 주소 필드(`fields.slug`)가 있으면 쓴다. 제목(`title`)은 모든 컬렉션에 있다.
	const slugField = Object.entries(schema.fields).find(([, field]) => field.kind === "slug")?.[0];
	const system = SYSTEM_COLUMNS.filter((column) => {
		// 항목 컬렉션은 발행 없이 저장이 곧 공개다. 언어 열은 이름이 있는 언어를 보인다(v2 B4).
		if (column === "publishedAt") return schema.kind === "document";
		if (column === "slug") return slugField !== undefined;
		return true;
	});
	const taxonomy = taxonomyFieldsOf(collection).map((stored) => stored.name);
	// 목록 설정에 적은 그 밖의 필드(`defineConfig`가 저장 필드인지 확인했다).
	const listed = [...new Set(schema.list?.columns ?? [])];
	const fieldColumns = listed.filter((column) => !taxonomy.includes(column) && fieldColumnOf(collection, column));
	// 분류 필드 컬럼은 언어 컬럼 뒤에 두고, 그 밖의 필드 컬럼이 그 뒤를 잇는다.
	const at = system.indexOf("locale") + 1;
	const available = [...system.slice(0, at), ...taxonomy, ...fieldColumns, ...system.slice(at)];
	const defaults = (schema.list?.columns ?? defaultListColumns(collection))
		.map((column) => (column === slugField ? "slug" : column))
		.filter((column) => available.includes(column));
	return { available, defaults };
}

/** 키가 컬럼 이름인 저장 값(표시·너비)에서 지금 쓸 수 있는 컬럼만 남긴다. */
export function knownColumnRecord<T>(
	record: Readonly<Record<string, T>> | undefined,
	available: readonly AdminListColumn[],
): Record<string, T> | undefined {
	if (!record) return undefined;
	return Object.fromEntries(Object.entries(record).filter(([column]) => available.includes(column)));
}

/**
 * 이 컬렉션에서 실제로 쓸 수 있는 필터. 항목 컬렉션은 활성/휴지통뿐이고,
 * 휴지통 화면은 모든 항목이 휴지통 상태라 상태 필터가 없다.
 */
export function filterFor(collection: string, column: AdminListColumn, mode: "list" | "trash" = "list"): ColumnFilter {
	const filter = columnConfig(collection, column).filter;
	if (filter.kind === "status" && (isItemCollection(collection) || mode === "trash")) return { kind: "none" };
	// 분류 항목의 언어 열은 이름이 있는 언어를 보일 뿐이라 언어로 거르지 않는다.
	if (filter.kind === "locale" && isItemCollection(collection)) return { kind: "none" };
	return filter;
}

/** 이 컬럼에 필터가 걸려 있는지. 숨긴 컬럼이어도 칩으로 계속 보인다. */
export function isColumnFiltered(state: ListState, filter: ColumnFilter): boolean {
	switch (filter.kind) {
		case "text":
			return state[filter.key].trim() !== "";
		case "status":
			return state.statuses.length > 0 || state.hasChanges;
		case "relation":
			return (state.relations[filter.field]?.length ?? 0) > 0;
		case "locale":
			return state.locales.length > 0;
		case "date":
			return Boolean(state[filter.from] || state[filter.to]);
		case "none":
			return false;
	}
}
