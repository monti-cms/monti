import { contentCollection, defaultLocale, otherContentCollection, recordRelationField } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { docOf } from "../../../test/stored-content";
import type { ExportSnapshot } from "../../core/store";
import type { StoredDocument } from "../../doc/stored-document";

/**
 * The collection, language and field names the fixture uses are looked up from the current config. In the reference blog setup, the public post is a post (`post`),
 * and the draft is a memo (`memo`). In a config with only one document collection with a body, both are that collection.
 */
export const FIXTURE_CONTENT_COLLECTION = contentCollection;
export const FIXTURE_DRAFT_COLLECTION = otherContentCollection ?? contentCollection;
export const FIXTURE_LOCALE = defaultLocale;

/** Category relation the public post's working copy points to (multi-value relations pointing to item collections first). The reference `kind` is the target collection. */
const fixtureRelation = (() => {
	for (const { name, field } of testSite.storedFields(contentCollection)) {
		if (field.kind === "relation" && field.many && testSite.isItemCollection(field.to)) return { name, to: field.to };
	}
	const found = recordRelationField(contentCollection);
	return found ? { name: found.name, to: found.to as string } : { name: "relationIds", to: "relation" };
})();
export const FIXTURE_RELATION_KIND = fixtureRelation.to;

/**
 * SEO values put in the published copy (field name found by role → value). Roles not in the config are dropped.
 * Checks that SEO metadata survives in the public archive.
 */
export const FIXTURE_SEO_METADATA: Readonly<Record<string, string>> = Object.fromEntries(
	(
		[
			["seoTitle", "검색 제목"],
			["seoDescription", "검색 설명"],
			["canonical", "https://dev.to/crosspost"],
			["ogImage", "44444444-4444-4444-8444-444444444444"],
		] as const
	).flatMap(([role, value]) => {
		const name = testSite.roleField(contentCollection, role)?.name;
		return name ? [[name, value]] : [];
	}),
);

/** Item file path inside the archive. */
export const fixtureEntryPath = (collection: string, id: string, file: string) => `entries/${collection}/${id}/${file}`;

export const FIXTURE_TIME = new Date("2026-09-22T00:00:00.000Z");

export const fixtureBody = (
	text: string,
	title: string,
	contentHash: string,
	extraMetadata: Record<string, unknown> = {},
) => ({
	metadata: { title, ...extraMetadata },
	doc: fixtureDocument(text),
	schemaVersion: 1,
	contentHash,
	updatedAt: FIXTURE_TIME,
});

const documents = new Map<string, StoredDocument>();

/**
 * The stored document of a fixture body. Reading a text draws new block ids each time, so a text is read once: every snapshot (and every test)
 * sees the same document for it.
 */
export function fixtureDocument(text: string): StoredDocument {
	const known = documents.get(text);
	if (known) return known;
	const doc = docOf(text);
	documents.set(text, doc);
	return doc;
}

/** Shared snapshot for export tests: 1 public post + 1 draft. */
export const makeExportFixtureSnapshot = (): ExportSnapshot => ({
	entries: [
		{
			id: "11111111-1111-4111-8111-111111111111",
			collection: FIXTURE_CONTENT_COLLECTION,
			locale: FIXTURE_LOCALE,
			translationGroupId: "11111111-1111-4111-8111-111111111111",
			status: "published",
			version: 3,
			folderId: null,
			workingSlug: "published-post",
			publishedSlug: "published-post",
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
			publishedAt: FIXTURE_TIME,
			working: fixtureBody("working body", "게시글", "hash-working-1"),
			published: fixtureBody("published body", "게시글", "hash-published-1", FIXTURE_SEO_METADATA),
		},
		{
			id: "22222222-2222-4222-8222-222222222222",
			collection: FIXTURE_DRAFT_COLLECTION,
			locale: FIXTURE_LOCALE,
			translationGroupId: "22222222-2222-4222-8222-222222222222",
			status: "draft",
			version: 1,
			folderId: null,
			workingSlug: "draft-memo",
			publishedSlug: null,
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
			publishedAt: null,
			working: fixtureBody("draft secret body", "메모", "hash-working-2"),
		},
		{
			// An archived post. Even if the published body remains, it must not go out in the public archive.
			id: "88888888-8888-4888-8888-888888888888",
			collection: FIXTURE_CONTENT_COLLECTION,
			locale: FIXTURE_LOCALE,
			translationGroupId: "88888888-8888-4888-8888-888888888888",
			status: "archived",
			version: 2,
			folderId: null,
			workingSlug: "archived-post",
			publishedSlug: "archived-post",
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
			publishedAt: FIXTURE_TIME,
			working: fixtureBody("archived working body", "보관글", "hash-working-3"),
			published: fixtureBody("archived published body", "보관글", "hash-published-3"),
		},
	],
	references: [
		{
			entryId: "11111111-1111-4111-8111-111111111111",
			state: "working",
			kind: FIXTURE_RELATION_KIND,
			targetId: "33333333-3333-4333-8333-333333333333",
			isStale: false,
			occurrences: [{ type: "metadata", path: fixtureRelation.name, ordinal: 0 }],
		},
		{
			entryId: "22222222-2222-4222-8222-222222222222",
			state: "working",
			kind: "media",
			targetId: "44444444-4444-4444-8444-444444444444",
			isStale: false,
			occurrences: [{ type: "mdx", line: 3, column: 1 }],
		},
		{
			// An image referenced only by the public post's working copy. It must not go out in the public list.
			entryId: "11111111-1111-4111-8111-111111111111",
			state: "working",
			kind: "media",
			targetId: "99999999-9999-4999-8999-999999999999",
			isStale: false,
			occurrences: [{ type: "mdx", line: 7, column: 1 }],
		},
		{
			// An image referenced by the public state. It must be included in the public list.
			entryId: "11111111-1111-4111-8111-111111111111",
			state: "published",
			kind: "media",
			targetId: "44444444-4444-4444-8444-444444444444",
			isStale: false,
			occurrences: [{ type: "mdx", line: 3, column: 1 }],
		},
	],
	folders: [
		{
			id: "55555555-5555-4555-8555-555555555555",
			collection: FIXTURE_CONTENT_COLLECTION,
			parentId: null,
			name: "루트",
			position: 0,
			version: 1,
		},
	],
	addresses: [
		{
			collection: FIXTURE_CONTENT_COLLECTION,
			locale: FIXTURE_LOCALE,
			slug: "old-slug",
			entryId: "11111111-1111-4111-8111-111111111111",
			type: "alias",
		},
	],
	media: [
		{
			id: "44444444-4444-4444-8444-444444444444",
			status: "ready",
			filename: "draft-only.png",
			mimeType: "image/png",
			byteSize: 10,
			width: 1,
			height: 1,
			stagingKey: null,
			storageKey: "media/draft-only.png",
			createdAt: FIXTURE_TIME,
			original: null,
			defaultAlt: "",
			defaultCaption: "",
			updatedAt: FIXTURE_TIME,
			readyAt: FIXTURE_TIME,
		},
		{
			id: "99999999-9999-4999-8999-999999999999",
			status: "ready",
			filename: "working-only.png",
			mimeType: "image/png",
			byteSize: 20,
			width: 2,
			height: 2,
			stagingKey: null,
			storageKey: "media/working-only.png",
			createdAt: FIXTURE_TIME,
			original: null,
			defaultAlt: "",
			defaultCaption: "",
			updatedAt: FIXTURE_TIME,
			readyAt: FIXTURE_TIME,
		},
	],
	templates: [
		{
			id: "66666666-6666-4666-8666-666666666666",
			name: "기본",
			doc: fixtureDocument("## 문제"),
			version: 1,
			createdAt: FIXTURE_TIME,
			updatedAt: FIXTURE_TIME,
		},
	],
	preferences: [{ userId: "admin", preferences: { defaultPageSize: 25 }, updatedAt: FIXTURE_TIME }],
});
