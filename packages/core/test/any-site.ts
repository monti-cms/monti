import type { ContentStore } from "../src/adapters/postgres/content-store";
import { COLLECTIONS, type Collection, DOCUMENT_COLLECTIONS, isItemCollection } from "../src/core/collections";
import { DEFAULT_LOCALE, LOCALES } from "../src/core/locales";
import type { PreparedSnapshot } from "../src/core/types";
import { type StoredField, schemaOf, storedField, storedFields } from "../src/schema/derive";
import { isRequiredField } from "../src/schema/fields";

/**
 * 설정과 상관없는 테스트(M10-1 재발 방지)가 쓰는 도우미. 컬렉션·필드 이름을 테스트에 적지 않고 지금 설정
 * (`@cms-config`)에서 찾는다. 같은 테스트가 블로그 예시 설정(`cms.config.ts`)과 다른 사이트 설정
 * (`other-site.config.ts`) 둘 다로 돈다. 라이브러리 약속인 제목 필드 `title`만 이름으로 쓴다.
 */

/** 본문이 있는 첫 문서 컬렉션. */
export const contentCollection: Collection = (() => {
	const found = DOCUMENT_COLLECTIONS.find((name) => schemaOf(name).body);
	if (!found) throw new Error("any-site: the config has no document collection with a body");
	return found;
})();

/** 첫 항목 컬렉션(`kind: "item"`). */
export const recordCollection: Collection = (() => {
	const found = COLLECTIONS.find((name) => isItemCollection(name));
	if (!found) throw new Error("any-site: the config has no item collection");
	return found;
})();

export const defaultLocale = DEFAULT_LOCALE;

/**
 * 기본 언어가 아닌 첫 언어(번역본 시험용). 언어가 하나뿐인 설정이면 없다.
 * 번역본이 필요한 테스트는 `describe.skipIf(!secondLocale)`로 감싼다.
 */
export const secondLocale: string | undefined = LOCALES.find((code) => code !== DEFAULT_LOCALE);

/** 본문이 있는 두 번째 문서 컬렉션(있으면). 컬렉션 사이 규칙(다른 컬렉션 주소 겹침 등)을 시험할 때 쓴다. */
export const otherContentCollection: Collection | undefined = DOCUMENT_COLLECTIONS.filter(
	(name) => schemaOf(name).body,
).find((name) => name !== contentCollection);

/** 제목 필드(라이브러리 약속상 이름은 `title`). */
export function titleFieldOf(collection: Collection) {
	const field = storedField(collection, "title")?.field;
	if (field?.kind !== "text") throw new Error(`any-site: ${collection} has no title text field`);
	return field;
}

/** 발행에 꼭 있어야 하는 저장 필드(조건부 필드 제외). */
export function requiredFields(collection: Collection): StoredField[] {
	return storedFields(collection).filter(({ field, when }) => !when && isRequiredField(field));
}

/** 처음 나오는 관계 필드(있으면). */
export function firstRelationField(collection: Collection): (StoredField & { to: Collection }) | undefined {
	for (const stored of storedFields(collection)) {
		if (stored.field.kind === "relation") return { ...stored, to: stored.field.to as Collection };
	}
	return undefined;
}

/** 처음 나오는 미디어 필드(있으면, `fields.media`). */
export function firstMediaField(collection: Collection): StoredField | undefined {
	return storedFields(collection).find((stored) => stored.field.kind === "media");
}

/** 미디어 필드가 있는 첫 컬렉션(본문이 있는 컬렉션 먼저). */
export const mediaFieldCollection: Collection | undefined = [
	...DOCUMENT_COLLECTIONS.filter((name) => schemaOf(name).body),
	...COLLECTIONS,
].find((name) => firstMediaField(name));

/**
 * 발행 필수값을 채운 메타데이터. 관계는 `relationTarget(대상 컬렉션)`이 돌려준 ID를 쓴다.
 * 텍스트는 `${이름표} value`, 선택은 첫 선택지다.
 */
export async function requiredMetadata(
	collection: Collection,
	title: string,
	relationTarget: (to: Collection) => Promise<string>,
): Promise<Record<string, string | string[]>> {
	const metadata: Record<string, string | string[]> = { title };
	for (const { name, field } of requiredFields(collection)) {
		if (name === "title") continue;
		if (field.kind === "text") metadata[name] = `${field.label} value`;
		else if (field.kind === "select") metadata[name] = Object.keys(field.options)[0] ?? "";
		else if (field.kind === "relation") {
			const id = await relationTarget(field.to as Collection);
			metadata[name] = field.many ? [id] : id;
		}
	}
	return metadata;
}

/** 항목 컬렉션(`kind: "item"`)을 가리키는 첫 관계 필드(있으면). `many`면 여러 개를 고른다. */
export function recordRelationField(
	collection: Collection,
): (StoredField & { to: Collection; many: boolean }) | undefined {
	for (const stored of storedFields(collection)) {
		const { field } = stored;
		if (field.kind === "relation" && isItemCollection(field.to)) {
			return { ...stored, to: field.to as Collection, many: Boolean(field.many) };
		}
	}
	return undefined;
}

/**
 * 저장소 테스트용: 원시 스냅샷(`seedEntry`)으로 만들거나 저장할 때 빠진 발행 필수 메타데이터를 채운다.
 * 블로그 테스트가 "게시글에는 카테고리가 필요하다"를 손으로 채우던 것을 설정과 상관없이 한다. 저장소를 바꿔 끼운다.
 * 관계 대상은 처음 필요할 때 대상 컬렉션에 공개 항목을 하나 만들어 다시 쓴다(`relationTarget`).
 * 필수값 검사를 시험하는 테스트는 돌려받은 `raw`(바꾸기 전 함수)로 저장한다.
 */
export function fillRequiredMetadata(store: ContentStore) {
	const raw = {
		createEntryWithReferences: store.createEntryWithReferences.bind(store),
		saveWorkingWithReferences: store.saveWorkingWithReferences.bind(store),
	};
	const targets = new Map<Collection, Promise<string>>();
	let sequence = 0;

	const relationTarget = (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const created = (async () => {
			const title = `fixture ${to} ${++sequence}`;
			const metadata = await requiredMetadata(to, title, relationTarget);
			const snapshot = {
				collection: to,
				slug: `fixture-${to}-${sequence}`,
				metadata,
				mdx: "",
				schemaVersion: 1,
				contentHash: `fixture-${to}-${sequence}`,
				references: [],
				issues: [],
				imageSources: [],
			} as unknown as PreparedSnapshot;
			const entry = await raw.createEntryWithReferences({
				snapshot,
				references: [],
				publishImmediately: isItemCollection(to),
			});
			if (entry.status === "published") return entry.id;
			return (await store.publishEntry({ id: entry.id, expectedVersion: entry.version })).id;
		})();
		targets.set(to, created);
		return created;
	};

	const fill = async <T extends { snapshot: PreparedSnapshot }>(params: T): Promise<T> => {
		const collection = params.snapshot.collection as Collection;
		if (!COLLECTIONS.includes(collection)) return params;
		const metadata = { ...(params.snapshot.metadata as Record<string, unknown>) };
		const title = typeof metadata.title === "string" ? metadata.title : "fixture";
		const required = await requiredMetadata(collection, title, relationTarget);
		for (const [name, value] of Object.entries(required)) {
			if (metadata[name] === undefined || metadata[name] === null || metadata[name] === "") metadata[name] = value;
		}
		return { ...params, snapshot: { ...params.snapshot, metadata } as PreparedSnapshot };
	};

	store.createEntryWithReferences = async (params) => raw.createEntryWithReferences(await fill(params));
	store.saveWorkingWithReferences = async (params) => raw.saveWorkingWithReferences(await fill(params));
	return { relationTarget, raw };
}
