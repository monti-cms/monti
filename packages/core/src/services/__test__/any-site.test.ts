import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	firstMediaField,
	firstRelationField,
	mediaFieldCollection,
	recordCollection,
	requiredMetadata,
	titleFieldOf,
} from "../../../test/any-site";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "../../adapters/postgres/__test__/test-database";
import {
	type ContentStore,
	createContentStore,
	type Entry,
	migrateContentStore,
} from "../../adapters/postgres/content-store";
import type { Collection } from "../../core/collections";
import { createContentService } from "../content-service";

/**
 * 설정과 상관없는 본체 흐름(M10-1 재발 방지). 컬렉션·필드 이름을 적지 않고 지금 설정에서 찾는다.
 * 블로그 예시 설정과 다른 사이트 설정(`vitest.othersite.config.ts`) 둘 다로 돈다.
 */
describe("any site: core content flow", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	/** 대상 컬렉션의 공개 항목 하나(분류는 저장이 곧 공개다). */
	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const metadata = await requiredMetadata(to, unique(`target ${to}`), relationTarget);
		const draft = await service.createDraft({ collection: to, slug: unique(to), metadata, mdx: "Body" });
		const entry =
			draft.status === "published" ? draft : await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		targets.set(to, entry.id);
		return entry.id;
	};

	const createContent = async (title: string) =>
		service.createDraft({
			collection: contentCollection,
			slug: unique("content"),
			metadata: await requiredMetadata(contentCollection, title, relationTarget),
			mdx: "Body text",
		});

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("saves a record from its title alone and derives the slug", async () => {
		const record = await service.createDraft({
			collection: recordCollection,
			slug: null,
			metadata: await requiredMetadata(recordCollection, "Any Site Record", relationTarget),
			mdx: "",
		});
		expect(record.status).toBe("published");
		expect(record.publishedSlug).toBe("any-site-record");
	});

	it("publishes a content entry built from the schema's required fields", async () => {
		const draft = await createContent("Published from schema");
		const published = await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		expect(published.status).toBe("published");
		expect(published.published?.metadata.title).toBe("Published from schema");
	});

	it("reports a missing title as missing_field with the title field's label", async () => {
		const draft = await service.createDraft({
			collection: contentCollection,
			slug: unique("untitled"),
			metadata: {},
			mdx: "Body text",
		});
		await expect(store.publishEntry({ id: draft.id, expectedVersion: draft.version })).rejects.toMatchObject({
			code: "publish_validation_failed",
			issues: expect.arrayContaining([
				{ code: "missing_field", path: "title", message: titleFieldOf(contentCollection).label },
			]),
		});
	});

	it("limits the title by the title field's own max", async () => {
		const { max, label } = titleFieldOf(contentCollection);
		if (max === undefined) return;
		const draft = await createContent("x".repeat(max));
		expect(draft.working.metadata.title).toHaveLength(max);
		await expect(createContent("x".repeat(max + 1))).rejects.toMatchObject({
			code: "field_too_long",
			issues: [{ code: "field_too_long", path: "title", message: label }],
		});
	});

	it("lists entries by title and names related entries by their title", async () => {
		const draft = await createContent("Findable headline");
		const list = await store.listEntries({ collection: contentCollection, titleContains: "Findable" });
		expect(list.items.map((item) => item.id)).toEqual([draft.id]);
		expect(list.items[0]?.title).toBe("Findable headline");
		const relation = firstRelationField(contentCollection);
		if (!relation) return;
		const value = draft.working.metadata[relation.name];
		if (value === undefined) return;
		const ids = Array.isArray(value) ? value : [value];
		expect(list.items[0]?.relations[relation.name]?.map((item) => item.id)).toEqual(ids);
		expect(list.items[0]?.relations[relation.name]?.every((item) => typeof item.title === "string")).toBe(true);
		const incoming = await store.getIncomingReferences({ targetId: String(ids[0]) });
		expect(incoming).toContainEqual(
			expect.objectContaining({ sourceId: draft.id, sourceTitle: "Findable headline", state: "working" }),
		);
	});

	it("duplicates with the title the caller gives and keeps it otherwise", async () => {
		const draft = await createContent("Original");
		const copy = await store.duplicateEntry({ id: draft.id, title: "Original (copy)" });
		expect(copy.working.metadata.title).toBe("Original (copy)");
		expect(copy.workingSlug).toBeNull();
		const same = await store.duplicateEntry({ id: draft.id });
		expect(same.working.metadata.title).toBe("Original");
	});

	describe("media fields (`fields.media`)", () => {
		const collection = mediaFieldCollection;
		const media = collection ? firstMediaField(collection) : undefined;
		const readyMedia = async (filename: string) => {
			const asset = await store.createMediaAsset({
				filename,
				mimeType: "image/png",
				byteSize: 10,
				stagingKey: `staging/${filename}`,
			});
			await store.completeMediaAsset({
				id: asset.id,
				storageKey: `media/${filename}`,
				mimeType: "image/png",
				byteSize: 10,
				width: 1,
				height: 1,
			});
			return asset;
		};
		const draftWith = async (title: string, mediaId: string) => {
			if (!collection || !media) throw new Error("no media field");
			const metadata = await requiredMetadata(collection, title, relationTarget);
			return service.createDraft({
				collection,
				slug: unique("media"),
				metadata: { ...metadata, [media.name]: mediaId },
				mdx: "Body text",
			} as Parameters<typeof service.createDraft>[0]);
		};

		it("the config has a media field (SEO share image)", () => {
			expect(media?.field.kind).toBe("media");
		});

		it("tracks the field value as a media reference: usage, the unused filter and the delete check", async () => {
			if (!collection || !media) return;
			const used = await readyMedia(`${unique("used")}.png`);
			const spare = await readyMedia(`${unique("spare")}.png`);
			const draft = await draftWith("Uses a share image", used.id);
			const list = await store.listMediaAssets({ pageSize: 100 });
			const usedItem = list.items.find((item) => item.id === used.id);
			expect(usedItem?.referencesCount).toBe(1);
			expect(usedItem?.references).toEqual([
				expect.objectContaining({ entryId: draft.id, state: "working", title: "Uses a share image" }),
			]);
			const unused = await store.listMediaAssets({ pageSize: 100, used: "unused" });
			expect(unused.items.map((item) => item.id)).toContain(spare.id);
			expect(unused.items.map((item) => item.id)).not.toContain(used.id);
			await expect(store.beginMediaDelete(used.id)).rejects.toMatchObject({
				code: "in_use",
				details: { references: 1 },
			});
			expect((await store.getMediaAsset(used.id))?.status).toBe("ready");
			// 발행본도 같은 참조를 가진다.
			const published = await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
			expect(published.published?.metadata[media.name]).toBe(used.id);
			const after = (await store.listMediaAssets({ pageSize: 100 })).items.find((item) => item.id === used.id);
			expect(after?.references.map((reference) => reference.state).sort()).toEqual(["published", "working"]);
		});

		it("rejects a value that is not a media ID and ignores an empty one", async () => {
			if (!collection || !media) return;
			await expect(draftWith("Bad media", "not-a-uuid")).rejects.toMatchObject({ code: "invalid_metadata_value" });
			const empty = await draftWith("No media", "");
			expect(empty.working.metadata[media.name]).toBe("");
		});

		it("blocks deleting media that only stored metadata mentions (saved before the field tracked it)", async () => {
			if (!collection || !media) return;
			const legacy = await readyMedia(`${unique("legacy")}.png`);
			const draft = await draftWith("Legacy share image", "");
			// 미디어 필드를 두기 전에 저장한 값처럼 참조 인덱스 없이 메타데이터에만 둔다.
			await pool.query(
				`UPDATE "${schemaName}".entry_bodies SET metadata = jsonb_set(metadata, $2, to_jsonb($3::text)) WHERE entry_id = $1`,
				[draft.id, [media.name], legacy.id],
			);
			await expect(store.beginMediaDelete(legacy.id)).rejects.toMatchObject({ code: "in_use", details: { bodies: 1 } });
		});
	});
});
