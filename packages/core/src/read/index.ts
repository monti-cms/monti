/**
 * 공개 화면 읽기(`@monti-cms/core/read`, M14-1). 서버 컴포넌트·라우트·sitemap·RSS가 공개본을 읽는다. 쓰기 기능은 없다.
 * 브라우저 코드에서 import하지 않는다.
 *
 * - 글 하나(`getEntry`): 옛 주소면 이동할 주소를 돌려주고, 이 언어 번역이 없으면 원문으로 대체할 수 있다.
 * - 목록(`listEntries`): 관계 조건·정렬·쪽 나누기를 DB에서 한다.
 * - 번역(`getTranslations`): 같은 글의 공개된 언어들과 주소(hreflang).
 * - 미리보기(`getPreview`): 관리자만, 최신 초안.
 * - 관계는 대상의 공개본으로 풀어 제목·주소를 붙인다(이 언어 → 없으면 원문).
 */
import { authGateway } from "../adapters/auth";
import type { EntryMetadata, PublishedEntryRecord } from "../adapters/postgres/content-store";
import type { PublishedSort } from "../adapters/postgres/store/public-read";
import type { ResolvedConfig } from "../config/resolved";
import { getCmsContentStore } from "../container";
import { type Collection, isCollection, isItemCollection } from "../core/collections";
import { contentPath } from "../core/links";
import { DEFAULT_LOCALE, isLocale, localizePath } from "../core/locales";
import type { MetadataOf } from "../schema/collection";
import {
	mergeTranslationMetadata,
	RECORD_TRANSLATIONS_KEY,
	recordLocalizedFields,
	storedFields,
} from "../schema/derive";

/** 사이트 설정에서 뽑은 컬렉션의 메타데이터 타입. */
export type MetadataFor<C extends Collection> = C extends keyof ResolvedConfig["collections"]
	? MetadataOf<ResolvedConfig["collections"][C]>
	: EntryMetadata;

/** 관계 필드가 가리키는 공개 항목. */
export interface ReadRelation {
	readonly id: string;
	readonly collection: string;
	readonly locale: string;
	readonly slug: string;
	/** 이 언어의 이름(항목 컬렉션의 언어별 이름 → 기본 이름). */
	readonly title: string | null;
	/** 공개 주소(컬렉션 `path`가 있으면, 언어 접두사 포함). */
	readonly path: string | null;
}

export interface ReadEntry<C extends Collection = Collection> {
	readonly id: string;
	readonly collection: C;
	/** 보여 주는 본문의 언어. 원문으로 대체했으면 원문 언어다. */
	readonly locale: string;
	readonly translationGroupId: string;
	readonly slug: string;
	/** 공개 주소(컬렉션 `path`가 있으면, 언어 접두사 포함). */
	readonly path: string | null;
	readonly title: string | null;
	readonly metadata: MetadataFor<C>;
	/** 관계 필드 이름 → 공개된 대상(선언·고른 순서). 공개되지 않은 대상은 빠진다. */
	readonly relations: Readonly<Record<string, readonly ReadRelation[]>>;
	/** 발행일(원문의 것). */
	readonly publishedAt: Date | null;
	/** 이 언어 본문의 수정일. */
	readonly updatedAt: Date;
	/** 본문 MDX. 목록에서는 `body: true`일 때만 채운다. */
	readonly mdx: string;
	/** 요청 언어 번역이 없어 원문을 보여 준다. */
	readonly fallback: boolean;
}

export type ReadEntryResult<C extends Collection = Collection> =
	| { readonly status: "found"; readonly entry: ReadEntry<C> }
	/** 옛 주소로 들어왔다. `path`(없으면 `slug`)로 영구 이동(308)한다. */
	| { readonly status: "redirect"; readonly slug: string; readonly path: string | null; readonly entry: ReadEntry<C> }
	| { readonly status: "not_found" };

const relationFieldsOf = (collection: Collection) =>
	storedFields(collection).filter((stored) => stored.field.kind === "relation");

const idsOf = (value: unknown): string[] =>
	typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];

const titleOf = (record: PublishedEntryRecord, locale: string): string | null => {
	const metadata = record.metadata as Record<string, unknown>;
	if (isCollection(record.collection) && recordLocalizedFields(record.collection).includes("title")) {
		const translations = metadata[RECORD_TRANSLATIONS_KEY] as Record<string, Record<string, unknown>> | undefined;
		const localized = translations?.[locale]?.title;
		if (typeof localized === "string" && localized.trim()) return localized;
	}
	return typeof metadata.title === "string" ? metadata.title : null;
};

const pathOf = (collection: string, slug: string, locale: string): string | null => {
	const path = contentPath(collection, slug);
	return path ? localizePath(locale, path) : null;
};

/** 관계 대상의 공개본을 모아(한 번에) 이 언어 → 원문 순서로 고른다. */
async function resolveRelations(
	records: readonly PublishedEntryRecord[],
	locale: string,
): Promise<Map<string, Record<string, ReadRelation[]>>> {
	const wanted = new Set<string>();
	for (const record of records) {
		if (!isCollection(record.collection)) continue;
		for (const { name } of relationFieldsOf(record.collection)) {
			for (const id of idsOf((record.metadata as Record<string, unknown>)[name])) wanted.add(id);
		}
	}
	const targets = await getCmsContentStore().listPublishedByGroups({ translationGroupIds: [...wanted] });
	const byGroup = new Map<string, PublishedEntryRecord[]>();
	for (const target of targets)
		byGroup.set(target.translationGroupId, [...(byGroup.get(target.translationGroupId) ?? []), target]);
	const pick = (groupId: string): ReadRelation | null => {
		const members = byGroup.get(groupId);
		if (!members) return null;
		const chosen =
			members.find((member) => member.locale === locale) ??
			members.find((member) => member.id === member.translationGroupId) ??
			members[0];
		if (!chosen) return null;
		return {
			id: chosen.translationGroupId,
			collection: chosen.collection,
			locale: chosen.locale,
			slug: chosen.slug,
			title: titleOf(chosen, locale),
			path: pathOf(chosen.collection, chosen.slug, chosen.locale),
		};
	};
	const result = new Map<string, Record<string, ReadRelation[]>>();
	for (const record of records) {
		const relations: Record<string, ReadRelation[]> = {};
		if (isCollection(record.collection)) {
			for (const { name } of relationFieldsOf(record.collection)) {
				relations[name] = idsOf((record.metadata as Record<string, unknown>)[name])
					.map(pick)
					.filter((relation): relation is ReadRelation => relation !== null);
			}
		}
		result.set(record.id, relations);
	}
	return result;
}

async function toReadEntries<C extends Collection>(
	records: readonly PublishedEntryRecord[],
	locale: string,
	fallback = false,
): Promise<ReadEntry<C>[]> {
	const relations = await resolveRelations(records, locale);
	return records.map((record) => ({
		id: record.id,
		collection: record.collection as C,
		locale: record.locale,
		translationGroupId: record.translationGroupId,
		slug: record.slug,
		path: pathOf(record.collection, record.slug, record.locale),
		title: titleOf(record, locale),
		metadata: record.metadata as MetadataFor<C>,
		relations: relations.get(record.id) ?? {},
		publishedAt: record.publishedAt,
		updatedAt: record.updatedAt,
		mdx: record.mdx,
		fallback,
	}));
}

const assertCollection = (collection: string): Collection => {
	if (!isCollection(collection)) throw new Error(`cms/read: unknown collection "${collection}"`);
	return collection;
};

/** 항목 컬렉션은 기본 언어 하나뿐이다(이름은 언어별 값으로 고른다). */
const storageLocale = (collection: Collection, locale: string | undefined) =>
	isItemCollection(collection) ? DEFAULT_LOCALE : locale && isLocale(locale) ? locale : DEFAULT_LOCALE;

/**
 * 글 하나. 주소(`slug`)는 그 언어의 주소다. 옛 주소면 `redirect`를 돌려준다.
 * `fallback: true`면 이 언어 번역이 없을 때 같은 주소의 원문(기본 언어)을 `fallback: true`로 돌려준다.
 */
export async function getEntry<C extends Collection>(params: {
	readonly collection: C;
	readonly slug: string;
	readonly locale?: string;
	readonly fallback?: boolean;
}): Promise<ReadEntryResult<C>> {
	const collection = assertCollection(params.collection);
	const locale = storageLocale(collection, params.locale);
	const slug = params.slug.normalize("NFC").trim();
	if (!slug) return { status: "not_found" };
	const store = getCmsContentStore();
	let lookup = await store.getPublishedEntryBySlug({ collection, slug, locale, includeBody: true });
	let fellBack = false;
	if (lookup.status === "not_found" && params.fallback && locale !== DEFAULT_LOCALE) {
		lookup = await store.getPublishedEntryBySlug({ collection, slug, locale: DEFAULT_LOCALE, includeBody: true });
		fellBack = lookup.status !== "not_found";
	}
	if (lookup.status === "not_found") return { status: "not_found" };
	const [entry] = await toReadEntries<C>([lookup.entry], params.locale ?? locale, fellBack);
	if (!entry) return { status: "not_found" };
	if (lookup.status === "alias") return { status: "redirect", slug: entry.slug, path: entry.path, entry };
	return { status: "found", entry };
}

/** 목록 한 쪽. 관계 조건(`where`)·정렬·쪽 나누기는 DB에서 한다. 본문은 `body: true`일 때만 읽는다. */
export async function listEntries<C extends Collection>(params: {
	readonly collection: C;
	readonly locale?: string;
	/** 관계 필드 이름 → 항목 ID(여러 개면 OR). 다른 필드끼리는 AND다. */
	readonly where?: Readonly<Record<string, string | readonly string[]>>;
	readonly sort?: PublishedSort;
	readonly order?: "asc" | "desc";
	readonly page?: number;
	readonly pageSize?: number;
	readonly body?: boolean;
}): Promise<{ items: ReadEntry<C>[]; total: number; page: number; pageSize: number }> {
	const collection = assertCollection(params.collection);
	const locale = storageLocale(collection, params.locale);
	const result = await getCmsContentStore().listPublishedPage({
		collection,
		locale,
		where: params.where,
		sort: params.sort,
		// 항목 컬렉션의 제목 정렬은 보이는 이름(이 언어의 번역 이름)으로 한다.
		titleLocale: params.locale ?? locale,
		order: params.order,
		page: params.page,
		pageSize: params.pageSize,
		includeBody: params.body === true,
	});
	return { ...result, items: await toReadEntries<C>(result.items, params.locale ?? locale) };
}

/** 같은 글의 공개된 언어들(원문 먼저)과 주소. hreflang·언어 바꾸기에 쓴다. */
export async function getTranslations(params: {
	readonly translationGroupId: string;
}): Promise<{ locale: string; slug: string; path: string | null }[]> {
	const members = await getCmsContentStore().listPublishedTranslations(params);
	return members.map((member) => ({
		locale: member.locale,
		slug: member.slug,
		path: pathOf(member.collection, member.slug, member.locale),
	}));
}

/**
 * 미리보기(관리자만). 최신 초안을 공개본과 같은 모양으로 돌려준다. 번역본은 원문 초안의 공통 값과 합친다.
 * 로그인하지 않았거나 관리자가 아니면 `null`이다. 관계는 공개된 대상만 풀린다.
 */
export async function getPreview<C extends Collection>(params: {
	readonly collection: C;
	readonly slug: string;
	readonly locale?: string;
}): Promise<ReadEntry<C> | null> {
	try {
		await authGateway.verifyAdmin();
	} catch {
		return null;
	}
	const collection = assertCollection(params.collection);
	const locale = storageLocale(collection, params.locale);
	const store = getCmsContentStore();
	const draft = await store.getWorkingEntryBySlug({ collection, slug: params.slug, locale });
	if (!draft || draft.status === "trashed") return null;
	let metadata = draft.working.metadata;
	if (draft.translationGroupId !== draft.id) {
		const source = await store.getEntry(draft.translationGroupId).catch(() => null);
		if (source) metadata = mergeTranslationMetadata(collection, source.working.metadata, metadata) as EntryMetadata;
	}
	const record: PublishedEntryRecord = {
		id: draft.id,
		collection,
		locale: draft.locale,
		translationGroupId: draft.translationGroupId,
		slug: draft.workingSlug ?? params.slug,
		metadata,
		mdx: draft.working.mdx,
		publishedAt: draft.publishedAt ?? null,
		updatedAt: draft.updatedAt,
	};
	const [entry] = await toReadEntries<C>([record], locale);
	return entry ?? null;
}

export type { PublishedSort } from "../adapters/postgres/store/public-read";
