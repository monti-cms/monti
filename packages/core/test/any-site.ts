import { COLLECTIONS, type Collection, DOCUMENT_COLLECTIONS, isItemCollection } from "../src/core/collections";
import { DEFAULT_LOCALE, LOCALES } from "../src/core/locales";
import type { ContentStore } from "../src/core/store";
import { publishDraft } from "../src/core/store/__test__/seed";
import type { PreparedSnapshot } from "../src/core/types";
import { type StoredField, schemaOf, storedField, storedFields } from "../src/schema/derive";
import { isRequiredField } from "../src/schema/fields";

/**
 * Helpers for config-agnostic tests (regression guard). Instead of writing collection and field names in tests, they are looked up from the current config
 * (`@cms-config`). The same test runs with both the reference blog config (`cms.config.ts`) and the other site config
 * (`other-site.config.ts`). Only the title field `title`, a library convention, is used by name.
 */

/** First document collection that has a body. */
export const contentCollection: Collection = (() => {
	const found = DOCUMENT_COLLECTIONS.find((name) => schemaOf(name).body);
	if (!found) throw new Error("any-site: the config has no document collection with a body");
	return found;
})();

/** First item collection (`kind: "item"`). */
export const recordCollection: Collection = (() => {
	const found = COLLECTIONS.find((name) => isItemCollection(name));
	if (!found) throw new Error("any-site: the config has no item collection");
	return found;
})();

export const defaultLocale = DEFAULT_LOCALE;

/**
 * First locale other than the default (for testing translations). Absent if the config has only one locale.
 * Tests that need a translation wrap themselves in `describe.skipIf(!secondLocale)`.
 */
export const secondLocale: string | undefined = LOCALES.find((code) => code !== DEFAULT_LOCALE);

/** Second document collection that has a body (if any). Used to test rules across collections (e.g. URL overlap with another collection). */
export const otherContentCollection: Collection | undefined = DOCUMENT_COLLECTIONS.filter(
	(name) => schemaOf(name).body,
).find((name) => name !== contentCollection);

/** Title field (by library convention its name is `title`). */
export function titleFieldOf(collection: Collection) {
	const field = storedField(collection, "title")?.field;
	if (field?.kind !== "text") throw new Error(`any-site: ${collection} has no title text field`);
	return field;
}

/** Stored fields required for publishing (excluding conditional fields). */
export function requiredFields(collection: Collection): StoredField[] {
	return storedFields(collection).filter(({ field, when }) => !when && isRequiredField(field));
}

/** First relation field (if any). */
export function firstRelationField(collection: Collection): (StoredField & { to: Collection }) | undefined {
	for (const stored of storedFields(collection)) {
		if (stored.field.kind === "relation") return { ...stored, to: stored.field.to as Collection };
	}
	return undefined;
}

/** First media field (if any, `fields.media`). */
export function firstMediaField(collection: Collection): StoredField | undefined {
	return storedFields(collection).find((stored) => stored.field.kind === "media");
}

/** First collection with a media field (collections with a body first). */
export const mediaFieldCollection: Collection | undefined = [
	...DOCUMENT_COLLECTIONS.filter((name) => schemaOf(name).body),
	...COLLECTIONS,
].find((name) => firstMediaField(name));

/**
 * Metadata with the publish-required values filled in. Relations use the ID returned by `relationTarget(target collection)`.
 * Text is `${label} value`, and a choice is the first option.
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

/** First relation field pointing to an item collection (`kind: "item"`), if any. If `many`, several can be chosen. */
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
 * For store tests: fills in publish-required metadata missing when creating or saving from a raw snapshot (`seedEntry`).
 * Does regardless of config what blog tests used to fill in by hand ("a post needs a category"). It swaps in the store.
 * A relation target is created once, on first need, as a public item in the target collection and then reused (`relationTarget`).
 * Tests of required-value validation save with the returned `raw` (the function before swapping).
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
			return (await publishDraft(store, { id: entry.id, expectedVersion: entry.version })).id;
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
