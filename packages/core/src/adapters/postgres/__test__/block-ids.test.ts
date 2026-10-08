import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { docOf } from "../../../../test/stored-content";
import type { Collection } from "../../../core/collections";
import type { Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { withoutBlockIds } from "../../../doc/block-ids";
import { STORED_DOCUMENT_VERSION } from "../../../doc/stored-document";
import { createContentService } from "../../../services/content-service";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** A heading, three paragraphs and a list: blocks at two depths. */
const BODY = "# Title\n\nFirst paragraph\n\nSecond paragraph\n\nThird paragraph\n\n- one\n- two\n";

/**
 * A save that changes nothing must not touch the stored body row of the Postgres store (the row version `xmin` stays). The block id behavior every
 * store shows is in the store contract.
 */
describe("block ids in the Postgres store: saves that write nothing", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let service: ReturnType<typeof createContentService<Entry>>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		service = createContentService<Entry>(store, { site: testSite });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const metadata = await requiredMetadata(to, unique(`target ${to}`), relationTarget);
		const draft = (
			await service.createDraft({
				collection: to,
				slug: unique(to),
				metadata,
				doc: docOf("Body"),
			})
		).entry;
		const published =
			draft.status === "published"
				? draft
				: await publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const createDraft = async (body: { doc: unknown }) =>
		service
			.createDraft({
				collection: contentCollection,
				slug: unique("post"),
				metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
				...body,
			} as never)
			.then((result) => result.entry);

	const save = (entry: Entry, body: { doc: unknown }) =>
		service
			.saveDraft(entry.id, {
				collection: contentCollection,
				slug: entry.workingSlug,
				metadata: entry.working.metadata as never,
				expectedVersion: entry.version,
				...body,
			} as never)
			.then((result) => result.entry);

	const stored = async (entryId: string, state: "working" | "published") => {
		const found = (
			await pool.query<{ doc: unknown; updated_at: Date; xmin: string }>(
				`SELECT doc, updated_at, xmin::text FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
				[entryId, state],
			)
		).rows[0];
		if (!found) throw new Error(`no ${state} body for ${entryId}`);
		return found;
	};

	it("saving the same document again keeps every id and writes nothing", async () => {
		const draft = await createDraft({ doc: docOf(BODY) });
		const before = await stored(draft.id, "working");

		const saved = await save(draft, { doc: docOf(BODY, draft.working.doc) });

		expect(saved.version).toBe(draft.version);
		expect(saved.updatedAt.getTime()).toBe(draft.updatedAt.getTime());
		const after = await stored(draft.id, "working");
		expect(after.doc).toEqual(before.doc);
		// Not even written back with the same value.
		expect(after.xmin).toBe(before.xmin);
		expect(after.updated_at.getTime()).toBe(before.updated_at.getTime());
		expect(saved.working.doc).toEqual(before.doc);
	});

	it("saving the same content without its ids keeps every id and writes nothing", async () => {
		const draft = await createDraft({ doc: docOf(BODY) });
		const before = await stored(draft.id, "working");

		const idless = {
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
			content: withoutBlockIds(draft.working.doc.content),
		};
		const saved = await save(draft, { doc: idless });

		expect(saved.version).toBe(draft.version);
		expect(saved.updatedAt.getTime()).toBe(draft.updatedAt.getTime());
		const after = await stored(draft.id, "working");
		expect(after.doc).toEqual(before.doc);
		expect(after.xmin).toBe(before.xmin);
	});

	it("a document sent back as it was read changes nothing", async () => {
		const draft = await createDraft({ doc: docOf(BODY) });
		const before = await stored(draft.id, "working");

		const saved = await save(draft, { doc: draft.working.doc });

		expect(saved.version).toBe(draft.version);
		const after = await stored(draft.id, "working");
		expect(after.doc).toEqual(before.doc);
		expect(after.xmin).toBe(before.xmin);
	});
});
