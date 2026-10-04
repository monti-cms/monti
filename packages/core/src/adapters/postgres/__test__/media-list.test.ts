import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ContentStore, createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("media list kind filter", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;

	const addReady = async (filename: string, mimeType: string, image: boolean) => {
		const media = await store.createMediaAsset({
			filename,
			mimeType,
			byteSize: 10,
			stagingKey: `staging/${filename}`,
		});
		await store.completeMediaAsset({
			id: media.id,
			storageKey: `media/${filename}`,
			mimeType,
			byteSize: 10,
			width: image ? 1 : null,
			height: image ? 1 : null,
		});
	};

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		await addReady("a.png", "image/png", true);
		await addReady("b.webp", "image/webp", true);
		await addReady("c.pdf", "application/pdf", false);
		await addReady("d.md", "text/markdown", false);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const names = async (params: Parameters<ContentStore["listMediaAssets"]>[0]) =>
		(await store.listMediaAssets(params)).items.map((item) => item.filename).sort();

	it("kind로 이미지와 파일을 나눠 보여 준다", async () => {
		expect(await names({})).toEqual(["a.png", "b.webp", "c.pdf", "d.md"]);
		expect(await names({ kind: "all" })).toEqual(["a.png", "b.webp", "c.pdf", "d.md"]);
		expect(await names({ kind: "image" })).toEqual(["a.png", "b.webp"]);
		expect(await names({ kind: "file" })).toEqual(["c.pdf", "d.md"]);
	});

	it("mimeType 필터는 그대로 동작한다", async () => {
		expect(await names({ mimeType: "image/png" })).toEqual(["a.png"]);
	});
});
