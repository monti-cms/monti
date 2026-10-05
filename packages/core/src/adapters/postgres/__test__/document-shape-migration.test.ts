import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import type { Collection } from "../../../core/collections";
import { computeContentHash } from "../../../core/content-hash";
import type { JsonValue } from "../../../core/types";
import { createContentService } from "../../../services/content-service";
import { createContentStore, type Entry, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * Migration steps that follow a change of how a body is read: stored hashes are recomputed (and, where the step says so, bodies and search text are rewritten),
 * so "unpublished changes" keeps meaning what it meant. Each test puts the store back in the state before the step ran and runs the migration again.
 */
describe("document shape migrations", () => {
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
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const metadata = await requiredMetadata(to, unique(`target ${to}`), relationTarget);
		const draft = await service.createDraft({ collection: to, slug: unique(to), metadata, mdx: "Body" });
		const published =
			draft.status === "published" ? draft : await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const createDraft = async (mdx: string) =>
		service.createDraft({
			collection: contentCollection,
			slug: unique("post"),
			metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
			mdx,
		});

	const publishedWith = async (mdx: string) => {
		const draft = await createDraft(mdx);
		return store.publishEntry({ id: draft.id, expectedVersion: draft.version });
	};

	const setWorkingBody = (entryId: string, mdx: string) =>
		pool.query(`UPDATE "${schemaName}".entry_bodies SET mdx = $1 WHERE entry_id = $2 AND state = 'working'`, [
			mdx,
			entryId,
		]);

	const hasUnpublishedChanges = async (entryId: string) => {
		const { items } = await store.listEntries({ collection: contentCollection });
		const item = items.find((candidate) => candidate.id === entryId);
		if (!item) throw new Error(`entry ${entryId} is not in the list`);
		return item.hasUnpublishedChanges;
	};

	/** Stored rows whose hash is not what the current hash rule gives for their metadata, MDX and schema version. */
	const staleHashes = async () => {
		const rows = await pool.query<{
			entry_id: string;
			state: string;
			metadata: JsonValue;
			mdx: string;
			schema_version: number;
			content_hash: string;
		}>(`SELECT entry_id, state, metadata, mdx, schema_version, content_hash FROM "${schemaName}".entry_bodies`);
		expect(rows.rows.length).toBeGreaterThan(0);
		return rows.rows
			.filter((row) => row.content_hash !== computeContentHash(row.metadata, row.mdx, row.schema_version))
			.map((row) => `${row.entry_id}/${row.state}`);
	};

	/** Stores a hash a previous version would have computed (anything that is not the current one) and marks the step as not applied yet. */
	const rewindTo = async (step: string) => {
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET content_hash = 'stale-' || state || '-' || entry_id`);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [step]);
	};

	describe("0011_line_break_hashes", () => {
		const STEP = "0011_line_break_hashes";

		it("is a recorded migration step", () => {
			expect(CONTENT_STORE_MIGRATIONS).toContain(STEP);
		});

		it("recomputes the hash of every body and keeps what the list shows as unpublished changes", async () => {
			const same = await publishedWith("첫 줄<br />\n둘째 줄");
			// A break written another way is the same content now (it was a different one while `<br />` and `\` were two nodes).
			const spelledOtherwise = await publishedWith("첫 줄<br />\n둘째 줄");
			await setWorkingBody(spelledOtherwise.id, "첫 줄\\\n둘째 줄");
			const edited = await publishedWith("첫 줄<br />\n둘째 줄");
			await setWorkingBody(edited.id, "첫 줄<br />\n다른 줄");

			await rewindTo(STEP);
			await migrateContentStore(pool, { schema: schemaName });

			expect(await staleHashes()).toEqual([]);
			expect(await hasUnpublishedChanges(same.id)).toBe(false);
			expect(await hasUnpublishedChanges(spelledOtherwise.id)).toBe(false);
			expect(await hasUnpublishedChanges(edited.id)).toBe(true);
		});

		it("does not touch bodies, versions or modified dates", async () => {
			const published = await publishedWith("첫 줄<br />\n둘째 줄");
			await rewindTo(STEP);

			await migrateContentStore(pool, { schema: schemaName });

			const after = await store.getEntry(published.id);
			expect(after.version).toBe(published.version);
			expect(after.updatedAt.getTime()).toBe(published.updatedAt.getTime());
			expect(after.working.updatedAt?.getTime()).toBe(published.working.updatedAt?.getTime());
			expect(after.working.mdx).toBe(published.working.mdx);
			expect(after.published).toEqual(published.published);
		});
	});
});
