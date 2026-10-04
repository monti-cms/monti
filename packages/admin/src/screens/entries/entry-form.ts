import {
	isCollection,
	localizedFieldNames,
	PREFIXED_LOCALES,
	parseTranslationState,
	RECORD_TRANSLATIONS_KEY,
	recordLocalizedFields,
	type SchemaCollection,
	type StoredField,
	storedField,
	storedFields,
	type TranslationState,
} from "@monti-cms/core/client";
import { t } from "./translate";

/** 폼 입력 하나의 값. 텍스트·한 개 관계·선택·날짜는 문자열(관계는 비면 `null`), 여러 개 관계는 배열이다. */
export type FormValue = string | string[] | null;

/**
 * 편집 화면이 다루는 초안 값(§5.2). 제목·주소·본문 외의 필드는 컬렉션 정의(v2 B1)에서 오며
 * 필드 이름을 키로 평평하게 둔다. 날짜 필드는 `datetime-local` 입력값(설정 시간대)이다.
 */
export type EntryForm = { title: string; slug: string; mdx: string } & { [field: string]: FormValue };

/** 폼 일부 변경. 지정한 키만 바꾼다. */
export type EntryFormPatch = { readonly [field: string]: FormValue };

export const EMPTY_FORM: EntryForm = { title: "", slug: "", mdx: "" };

/**
 * 복제본 제목(라이브러리 약속상 제목 필드 이름은 `title`). 원본 제목 뒤에 " (복사)"를 붙이고, 제목 필드의 `max`를
 * 넘으면 원본 쪽을 줄인다.
 */
export function copyTitle(collection: string, title: string | null | undefined): string {
	// 복제본 제목에 붙이는 말과 제목이 빈 원본의 이름은 화면 문구이므로 저장소가 아니라 관리자 화면이 정한다.
	const copySuffix = t("copy.suffix");
	const base = title?.trim() ? title : t("untitled");
	const field = isCollection(collection) ? storedField(collection, "title")?.field : undefined;
	const max = field?.kind === "text" ? field.max : undefined;
	const room = max === undefined ? Number.POSITIVE_INFINITY : max - Array.from(copySuffix).length;
	const chars = Array.from(base);
	if (room <= 0) return chars.slice(0, max).join("");
	return `${chars.length > room ? chars.slice(0, room).join("") : base}${copySuffix}`;
}

/** 같은 번역 묶음의 콘텐츠(v2 B4). */
export interface TranslationMember {
	id: string;
	locale: string;
	status: EntryData["status"];
	isSource: boolean;
	title: string | null;
	workingSlug: string | null;
}

export interface EntryData {
	id: string;
	collection: string;
	/** 콘텐츠 언어와 번역 묶음 ID(v2 B4). 원문이면 묶음 ID가 자기 ID다. */
	locale?: string;
	translationGroupId?: string;
	translations?: TranslationMember[];
	/** 번역본이면 원문의 최신 초안 메타데이터. 공통 값을 읽기 전용으로 보여 준다. */
	source?: {
		id: string;
		locale: string;
		status: EntryData["status"];
		workingSlug: string | null;
		metadata: Record<string, unknown>;
		/** 원문 최신 초안 본문(v3 번역 화면). */
		mdx?: string;
	};
	status: "draft" | "published" | "archived" | "trashed";
	version: number;
	folderId: string | null;
	publishedAt?: string;
	workingSlug: string | null;
	publishedSlug: string | null;
	working: { metadata: Record<string, unknown>; mdx: string; translation?: TranslationState | null };
	published?: { metadata: Record<string, unknown>; mdx: string };
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** 폼 값을 문자열로 읽는다. 없거나 배열이면 빈 문자열이다. */
export const formText = (form: EntryForm, name: string): string => text(form[name]);

/** 폼 값을 문자열 배열로 읽는다. */
export const formList = (form: EntryForm, name: string): string[] => {
	const value = form[name];
	return Array.isArray(value) ? value : [];
};

/** 번역본인가(v2 B4). 번역본은 언어별 값만 폼으로 다룬다. */
export const isTranslationEntry = (entry: Pick<EntryData, "id" | "translationGroupId"> | null | undefined) =>
	Boolean(entry?.translationGroupId && entry.translationGroupId !== entry.id);

/** 번역 화면이 보여 줄 원문. 원문 본문을 함께 받은 번역본일 때만 있다. */
export interface TranslationSource {
	mdx: string;
	locale: string;
	title: string;
}

/** 번역본이면 원문 본문·언어·제목. 원문 창·제목 안내·AI 번역이 쓴다(v3). */
export function translationSourceOf(entry: EntryData | null): TranslationSource | null {
	if (!entry || !isTranslationEntry(entry) || typeof entry.source?.mdx !== "string") return null;
	const title = entry.source.metadata.title;
	return { mdx: entry.source.mdx, locale: entry.source.locale, title: typeof title === "string" ? title : "" };
}

/** 폼이 다루는 저장 필드. 번역본이면 정의에서 `localized`인 필드만이다(공통 값은 원문이 가진다). */
const fieldsOf = (collection: string, translation = false): readonly StoredField[] => {
	if (!isCollection(collection)) return [];
	const fields = storedFields(collection as SchemaCollection);
	if (!translation) return fields;
	const { own, inherit } = localizedFieldNames(collection as SchemaCollection);
	return fields.filter(({ name }) => own.includes(name) || inherit.includes(name));
};

/** 번역 상태를 담는 폼 키(v3). 저장 필드 이름과 겹치지 않게 `$`로 시작한다. 값은 JSON 문자열이다. */
export const TRANSLATION_FORM_KEY = "$translation";

/** 번역 상태의 JSON 문자열. 키 순서를 고정해 서버(JSONB는 키 순서를 바꾼다)에서 온 값과 지문이 같게 한다. */
export const stringifyTranslation = (state: TranslationState) =>
	JSON.stringify({ version: 2, baseSource: state.baseSource });

/** 폼 값 → 번역 상태. 없거나 모양이 다르면 아무것도 확인하지 않은 상태(`baseSource` 빈 값)다. */
export const translationStateFromForm = (value: FormValue | undefined): TranslationState => {
	if (typeof value === "string") {
		try {
			const parsed = parseTranslationState(JSON.parse(value));
			if (parsed) return parsed;
		} catch {
			// 깨진 값은 확인하지 않은 것으로 본다.
		}
	}
	return { version: 2, baseSource: "" };
};

/** 폼 값 → 저장 요청의 `translation`. 번역본이 아니면(키가 없으면) 보내지 않는다. */
export const translationPayload = (form: EntryForm): TranslationState | undefined => {
	const value = form[TRANSLATION_FORM_KEY];
	if (typeof value !== "string") return undefined;
	return translationStateFromForm(value);
};

/** 저장 값 → 입력 값. */
function toFormValue({ field }: StoredField, value: unknown): FormValue {
	switch (field.kind) {
		case "text":
		case "media":
			return text(value);
		case "relation":
			if (field.many) return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
			return text(value) || null;
		case "select":
			return typeof value === "string" && Object.hasOwn(field.options, value) ? value : field.defaultValue;
	}
}

export function formFromEntry(entry: EntryData): EntryForm {
	const metadata = entry.working.metadata ?? {};
	const form: EntryForm = { title: text(metadata.title), slug: entry.workingSlug ?? "", mdx: entry.working.mdx ?? "" };
	for (const stored of fieldsOf(entry.collection, isTranslationEntry(entry))) {
		if (stored.name === "title" || stored.field.hidden) continue;
		form[stored.name] = toFormValue(stored, metadata[stored.name]);
	}
	Object.assign(form, recordTranslationsToForm(entry.collection, metadata));
	// 번역본은 번역 상태도 폼으로 다룬다(v3). 자동 저장·복구본·충돌 비교가 본문과 함께 본다.
	if (isTranslationEntry(entry)) {
		// 유효한 v2 상태가 아니면 빈 `baseSource`로 둬 "원문이 바뀌었어요"가 보이게 한다.
		form[TRANSLATION_FORM_KEY] = stringifyTranslation(
			parseTranslationState(entry.working.translation) ?? { version: 2, baseSource: "" },
		);
	}
	return form;
}

/** record 컬렉션 언어별 값의 폼 키(v2 B4). 예: `title@en`. */
export const recordTranslationKey = (field: string, locale: string) => `${field}@${locale}`;

function recordTranslationsToForm(collection: string, metadata: Record<string, unknown>): Record<string, string> {
	if (!isCollection(collection)) return {};
	const translations = (metadata[RECORD_TRANSLATIONS_KEY] ?? {}) as Record<string, Record<string, unknown>>;
	const values: Record<string, string> = {};
	for (const field of recordLocalizedFields(collection as SchemaCollection)) {
		for (const locale of PREFIXED_LOCALES)
			values[recordTranslationKey(field, locale)] = text(translations[locale]?.[field]);
	}
	return values;
}

/** 원문 메타데이터를 폼 값으로 바꾼다. 번역본 속성 패널이 공통 값을 읽기 전용으로 보여 줄 때 쓴다(v2 B4). */
export function formFromSourceMetadata(collection: string, metadata: Record<string, unknown>): EntryForm {
	const form: EntryForm = { title: text(metadata.title), slug: "", mdx: "" };
	for (const stored of fieldsOf(collection)) {
		if (stored.name === "title" || stored.field.hidden) continue;
		form[stored.name] = toFormValue(stored, metadata[stored.name]);
	}
	return form;
}

/** 폼 값이 같은지 비교하는 지문. 복구본과 서버 저장본을 비교한다. */
export const formFingerprint = (form: EntryForm) => JSON.stringify(form);

/**
 * 폼 → 저장 메타데이터. 규칙은 컬렉션 정의에서 온다(v2 B1).
 *
 * - 필수 텍스트(제목)는 입력 그대로 저장한다. 선택 텍스트·관계는 비우면 키를 지워 공개 화면이 기본값으로 돌아가게 한다.
 * - 선택 필드는 기본값이면 새로 쓰지 않는다. 이미 저장된 값은 그대로 갱신한다.
 * - 조건부 필드에 딸린 값은 조건이 맞을 때만 남긴다.
 * - 입력을 그리지 않는 필드(`hidden`)는 저장된 값을 건드리지 않는다. 정의에 없는 키는 넣지 않는다.
 */
export function metadataFromForm(
	form: EntryForm,
	collection: string,
	base: Record<string, unknown> = {},
	options: { translation?: boolean } = {},
): { metadata: Record<string, unknown> } | { error: string } {
	const fields = fieldsOf(collection, options.translation);
	const metadata: Record<string, unknown> = {};
	for (const { name } of fields) {
		if (Object.hasOwn(base, name)) metadata[name] = base[name];
	}
	const values: Record<string, FormValue> = { ...form };

	for (const { name, field, when } of fields) {
		if (field.hidden) continue;
		const active = !when || values[when.field] === when.value;
		const value = values[name];
		if (!active) {
			delete metadata[name];
			continue;
		}
		switch (field.kind) {
			case "text":
			case "media": {
				const raw = text(value);
				if (field.required) metadata[name] = raw;
				else if (raw.trim()) metadata[name] = raw.trim();
				else delete metadata[name];
				break;
			}
			case "relation":
				if (field.many) {
					if (Array.isArray(value) && value.length > 0) metadata[name] = value;
					else delete metadata[name];
				} else if (typeof value === "string" && value.trim()) metadata[name] = value.trim();
				else delete metadata[name];
				break;
			case "select": {
				const selected = typeof value === "string" && Object.hasOwn(field.options, value) ? value : field.defaultValue;
				if (selected !== field.defaultValue || Object.hasOwn(base, name)) metadata[name] = selected;
				else delete metadata[name];
				break;
			}
		}
	}

	// record 컬렉션의 언어별 이름·설명(v2 B4). 빈 언어는 넣지 않는다.
	const localizedRecordFields = isCollection(collection) ? recordLocalizedFields(collection as SchemaCollection) : [];
	if (localizedRecordFields.length > 0) {
		const translations: Record<string, Record<string, string>> = {};
		for (const locale of PREFIXED_LOCALES) {
			for (const field of localizedRecordFields) {
				const value = text(values[recordTranslationKey(field, locale)]).trim();
				if (value) translations[locale] = { ...translations[locale], [field]: value };
			}
		}
		if (Object.keys(translations).length > 0) metadata[RECORD_TRANSLATIONS_KEY] = translations;
		else delete metadata[RECORD_TRANSLATIONS_KEY];
	}
	return { metadata };
}
