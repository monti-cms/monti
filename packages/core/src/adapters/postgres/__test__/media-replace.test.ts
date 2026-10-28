import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import type { ContentStore } from "../../../core/store";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** `replaceMediaFile` is one transaction: when a step fails, the row that was removed comes back and the target is unchanged. */
describe("postgres: replacing the file of a media file", () => {
	let pool: Pool;
	let schema: string;
	let store: ContentStore;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schema = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema });
		store = createContentStore(pool, { site: testSite, schema });
	});

	afterAll(async () => {
		if (pool && schema) await dropIsolatedTestPool(pool, schema);
		await closeGlobalPool();
	});

	const addReady = async (filename: string) => {
		const media = await store.createMediaAsset({
			filename,
			mimeType: "image/png",
			byteSize: 10,
			stagingKey: `staging/${filename}`,
		});
		return store.completeMediaAsset({
			id: media.id,
			storageKey: `media/${filename}`,
			mimeType: "image/png",
			byteSize: 10,
			width: 1,
			height: 1,
		});
	};

	it("rolls back the removed row when the update of the target fails", async () => {
		const target = await addReady("target.png");
		const source = await addReady("source.png");
		// The target's update is the last step; make only that one fail.
		await pool.query(`
			CREATE FUNCTION "${schema}".fail_replace() RETURNS trigger AS $$
			BEGIN
				IF NEW.id = '${target.id}' THEN RAISE EXCEPTION 'update refused'; END IF;
				RETURN NEW;
			END $$ LANGUAGE plpgsql;
			CREATE TRIGGER fail_replace BEFORE UPDATE ON "${schema}".media_assets
				FOR EACH ROW EXECUTE FUNCTION "${schema}".fail_replace();
		`);
		try {
			await expect(store.replaceMediaFile({ id: target.id, fromId: source.id })).rejects.toThrow("update refused");
		} finally {
			await pool.query(`DROP TRIGGER fail_replace ON "${schema}".media_assets`);
		}

		expect(await store.getMediaAsset(source.id)).toEqual(source);
		expect(await store.getMediaAsset(target.id)).toEqual(target);
	});
});
