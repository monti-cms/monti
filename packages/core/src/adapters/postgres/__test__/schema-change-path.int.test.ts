import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { docOf } from "../../../../test/stored-content";
import type { CmsConfig } from "../../../config/define";
import { defineSite } from "../../../config/define";
import { defineCollection } from "../../../schema/collection";
import { applySchemaChange, checkSchemaChange, planSchemaChange } from "../../../schema-change";
import { createContentService } from "../../../services/content-service";
import { createSite, type Site } from "../../../site";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** A public path change against a real database: the impact check counts the published entries whose address changes, and only those. */

const title = { kind: "text", label: "Title", required: true } as const;
const slug = { kind: "slug", label: "Address", from: "title" } as const;

const siteWith = (postPath: string) =>
	createSite(
		defineSite({
			collections: {
				post: defineCollection({
					label: "Post",
					kind: "document",
					path: postPath as `/${string}:slug`,
					fields: { title, slug },
				}),
				page: defineCollection({ label: "Page", kind: "document", path: "/pages/:slug", fields: { title, slug } }),
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		}) as CmsConfig,
	);

describe("schema change: collection path", () => {
	let pool: Pool;
	let schemaName: string;
	const before = siteWith("/posts/:slug");
	const after = siteWith("/blog/:slug");

	const storeFor = (site: Site) => createContentStore(pool, { site, schema: schemaName });

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: before, schema: schemaName });
		const store = storeFor(before);
		const service = createContentService(store, { site: before });

		const draft = async (collection: "post" | "page", slugText: string) =>
			(
				await service.createDraft({
					collection,
					slug: slugText,
					metadata: { title: slugText },
					doc: docOf(`Body of ${slugText}`),
				} as never)
			).entry;
		const publish = async (collection: "post" | "page", slugText: string) => {
			const entry = await draft(collection, slugText);
			return (await service.publish({ id: entry.id, expectedVersion: entry.version })).entry;
		};

		await publish("post", "published-1");
		await publish("post", "published-2");
		// Published, then edited: it has a published copy and a working copy, and counts once.
		const edited = await publish("post", "published-3");
		await service.saveDraft(edited.id, {
			collection: "post",
			slug: "published-3",
			metadata: { title: "published-3 edited" },
			doc: docOf("Edited"),
			expectedVersion: edited.version,
		} as never);
		await draft("post", "draft-1");
		await draft("post", "draft-2");
		const trashed = await draft("post", "trashed-1");
		await store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });
		// Another collection with a published entry: its address does not change.
		await publish("page", "about");
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("SCHEMA-A1 counts the published entries of the collection whose path changed: not drafts, not trashed ones, not other collections, an edited one once", async () => {
		const store = storeFor(after);
		await applySchemaChange({ site: before, store: storeFor(before), migrations: [] });
		const plan = await planSchemaChange({ site: after, store, migrations: [] });
		expect(plan.diff.changes).toEqual([
			{ kind: "collection_path_changed", collection: "post", from: "/posts/:slug", to: "/blog/:slug" },
		]);
		const { impacts } = await checkSchemaChange(store, plan.diff, { site: after });
		expect(impacts).toHaveLength(1);
		expect(impacts[0]).toMatchObject({ consequence: "address_changed", entries: 3, checked: true });
		expect(impacts[0]?.sample).toHaveLength(3);
		expect(impacts[0]?.sample.every((item) => item.collection === "post")).toBe(true);
	});
});
