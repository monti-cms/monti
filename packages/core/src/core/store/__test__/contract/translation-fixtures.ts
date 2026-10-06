import {
	contentCollection,
	defaultLocale,
	recordRelationField,
	requiredMetadata,
	secondLocale,
} from "../../../../../test/any-site";
import { localizedFieldNames, recordLocalizedFields, storedField, storedFields } from "../../../../schema/derive";
import { createContentService } from "../../../../services/content-service";
import { COLLECTIONS, type Collection } from "../../../collections";
import { LOCALES } from "../../../locales";
import type { ContentStore, Entry } from "../..";
import { publishDraft } from "../seed";

/**
 * Languages and fields used by translation tests. Collection, field, and language names are looked up in the current config (`test/any-site.ts`).
 * For a config with only one language the translation tests are skipped, and cases that need a third language are skipped separately.
 */
export const second = secondLocale ?? "";
export const thirdLocale = LOCALES.filter((code) => code !== defaultLocale)[1];
export const unknownLocale = "zz";
export const localized = (() => {
	const { own, inherit } = localizedFieldNames(contentCollection);
	return new Set([...own, ...inherit]);
})();
/** Per-language text fields other than the title. The first is also filled on translations; the second is filled only on the source to check it does not leak into translations. */
export const [translatedText, sourceOnlyText] = localizedFieldNames(contentCollection).own.filter((name) => {
	const stored = storedField(contentCollection, name);
	return name !== "title" && !stored?.when && stored?.field.kind === "text";
});
/** Select field shared by a translation group. Sets a non-default value on the source to check it carries over to the translation's published values. */
export const commonSelect = (() => {
	for (const { name, field, when } of storedFields(contentCollection)) {
		if (when || localized.has(name) || field.kind !== "select") continue;
		const value = Object.keys(field.options).find((key) => key !== field.defaultValue);
		if (value) return { name, value };
	}
	return undefined;
})();
/** Shared relation field that points at an item collection (like categories). */
export const relation = (() => {
	const found = recordRelationField(contentCollection);
	return found && !localized.has(found.name) ? found : undefined;
})();
/** Item collection that keeps per-language names inside a single record. */
export const localizedRecord = COLLECTIONS.find((name) => recordLocalizedFields(name).length > 0);

/** Per-language values a translation stores (title and the first per-language text). */
export const translatedMetadata = (title: string, text: string) => ({
	title,
	...(translatedText ? { [translatedText]: text } : {}),
});

/** Helpers that create the posts and relation targets of the translation tests in a store. */
export function translationHelpers(store: ContentStore) {
	const service = createContentService<Entry>(store);
	let sequence = 0;

	/** A new published item of the target collection. Created fresh for each entry so that only that entry appears when filtering by relation. */
	const relationTarget = async (to: Collection): Promise<string> => {
		const metadata = await requiredMetadata(to, "에세이", relationTarget);
		const draft = await service.createDraft({
			collection: to,
			slug: `${to}-${++sequence}`,
			metadata,
			format: "mdx",
			body: "",
		});
		if (draft.status === "published") return draft.id;
		return (await publishDraft(store, { id: draft.id, expectedVersion: draft.version })).id;
	};

	const createPost = async (slug: string) => {
		const metadata: Record<string, unknown> = await requiredMetadata(contentCollection, "한국어 제목", relationTarget);
		if (translatedText) metadata[translatedText] = "한국어 요약";
		if (sourceOnlyText) metadata[sourceOnlyText] = "검색 제목";
		if (commonSelect) metadata[commonSelect.name] = commonSelect.value;
		if (relation && metadata[relation.name] === undefined) {
			const id = await relationTarget(relation.to);
			metadata[relation.name] = relation.many ? [id] : id;
		}
		return service.createDraft({
			collection: contentCollection,
			slug,
			metadata: metadata as never,
			format: "mdx",
			body: "한국어 본문",
		});
	};

	return { service, relationTarget, createPost };
}
