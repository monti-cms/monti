import { NextRequest } from "next/server";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
} from "../../../adapters/postgres/__test__/test-database";
import { createContentStore, type Entry, migrateContentStore } from "../../../adapters/postgres/content-store";
import type { Collection } from "../../../core/collections";
import { MAX_DOC_BYTES } from "../../../core/snapshot";
import { bodyFromMdx } from "../../../mdx/stored-document";
import { createContentService } from "../../../services/content-service";
import { GET as getEntry, PATCH as patchEntry } from "../entries/[id]/route";
import { POST as postEntries } from "../entries/route";
import { GET as getTemplates } from "../templates/route";

const holder = vi.hoisted(() => ({ store: undefined as unknown, service: undefined as unknown }));

vi.mock("../../../adapters/auth", () => ({
	authGateway: { verifyAdmin: () => Promise.resolve({ userId: "admin" }) },
	AuthError: class AuthError extends Error {},
}));

vi.mock("../../../container", () => ({
	getCmsContentStore: () => holder.store,
	getCmsContentService: () => holder.service,
}));

/** The same content in a spelling the serializer does not write, and the text a save writes for it. */
const UNTIDY = "Title\n=====\n\nSome _emphasis_ here\n\n* one\n* two\n";
const TIDY = "# Title\n\nSome *emphasis* here\n\n- one\n- two\n";

const send = (url: string, method: string, body: unknown) =>
	new NextRequest(url, {
		method,
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: JSON.stringify(body),
	});

/** The admin entry API with a real store and service: bodies are accepted as a stored document as well as MDX. */
describe("entry API with a stored document", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		holder.store = store;
		holder.service = createContentService<Entry>(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const draft = await (holder.service as ReturnType<typeof createContentService<Entry>>).createDraft({
			collection: to,
			slug: unique(to),
			metadata: await requiredMetadata(to, unique(`target ${to}`), relationTarget),
			mdx: "Body",
		});
		const published =
			draft.status === "published" ? draft : await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const post = async (body: Record<string, unknown>) =>
		postEntries(
			send("http://localhost/api/cms/v1/entries", "POST", {
				collection: contentCollection,
				slug: unique("post"),
				metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
				...body,
			}),
		);

	const patch = (id: string, body: Record<string, unknown>) =>
		patchEntry(send(`http://localhost/api/cms/v1/entries/${id}`, "PATCH", body), { params: Promise.resolve({ id }) });

	const read = async (id: string) => {
		const res = await getEntry(new NextRequest(`http://localhost/api/cms/v1/entries/${id}`), {
			params: Promise.resolve({ id }),
		});
		expect(res.status).toBe(200);
		return (await res.json()) as Entry;
	};

	const created = async (body: Record<string, unknown>) => {
		const res = await post(body);
		expect(res.status).toBe(201);
		return (await res.json()) as Entry;
	};

	const storedRow = async (id: string) =>
		(
			await pool.query(
				`SELECT mdx, doc, content_hash, updated_at FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
				[id],
			)
		).rows[0];

	it("creates an entry from a document, storing the MDX written from it", async () => {
		const doc = bodyFromMdx(UNTIDY).doc;
		expect(doc).not.toBeNull();

		const entry = await created({ doc });

		expect(entry.working.mdx).toBe(TIDY);
		expect(entry.working.doc).toEqual(doc);
		const row = await storedRow(entry.id);
		expect(row.mdx).toBe(TIDY);
		expect(row.doc).toEqual(doc);
	});

	it("creates an entry from MDX as before, and with no body it is empty", async () => {
		const fromMdx = await created({ mdx: UNTIDY });
		expect(fromMdx.working.mdx).toBe(TIDY);
		expect(fromMdx.working.doc).toEqual(bodyFromMdx(UNTIDY).doc);

		const empty = await created({});
		expect(empty.working.mdx).toBe("");
	});

	it("rejects a create that sends both mdx and doc", async () => {
		const res = await post({ mdx: TIDY, doc: bodyFromMdx(TIDY).doc });
		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe("invalid_input");
	});

	it("rejects a create with a document that is not a stored document", async () => {
		const doc = bodyFromMdx(TIDY).doc;
		const invalid: unknown[] = [
			{ ...(doc as object), version: 999 },
			{ type: "doc", version: 1, content: "not a list" },
			{ type: "paragraph" },
			"text",
			42,
			null,
			[],
		];
		for (const value of invalid) {
			const res = await post({ doc: value });
			expect(res.status, JSON.stringify(value)).toBe(400);
			expect((await res.json()).code).toBe("invalid_input");
		}
	});

	it("saves a document with a patch", async () => {
		const entry = await created({ mdx: "First\n" });
		const doc = bodyFromMdx(UNTIDY).doc;

		const res = await patch(entry.id, { expectedVersion: entry.version, doc });

		expect(res.status).toBe(200);
		const saved = (await res.json()) as Entry;
		expect(saved.version).toBe(entry.version + 1);
		expect(saved.working.mdx).toBe(TIDY);
		expect(saved.working.doc).toEqual(doc);
		const row = await storedRow(entry.id);
		expect(row.mdx).toBe(TIDY);
		expect(row.doc).toEqual(doc);
	});

	it("keeps the body when a patch sends neither mdx nor doc", async () => {
		const entry = await created({ doc: bodyFromMdx(UNTIDY).doc });

		const res = await patch(entry.id, { expectedVersion: entry.version, metadata: entry.working.metadata });

		expect(res.status).toBe(200);
		const saved = (await res.json()) as Entry;
		expect(saved.version).toBe(entry.version);
		expect(saved.working.mdx).toBe(TIDY);
	});

	it("rejects a patch that sends both mdx and doc", async () => {
		const entry = await created({ mdx: "First\n" });

		const res = await patch(entry.id, { expectedVersion: entry.version, mdx: TIDY, doc: bodyFromMdx(TIDY).doc });

		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe("invalid_input");
		expect((await read(entry.id)).working.mdx).toBe("First\n");
	});

	it("rejects a patch with a document that is not a stored document, and changes nothing", async () => {
		const entry = await created({ mdx: "First\n" });
		const doc = bodyFromMdx(TIDY).doc;

		for (const value of [{ ...(doc as object), version: 999 }, { type: "doc", version: 1 }, "text", null]) {
			const res = await patch(entry.id, { expectedVersion: entry.version, doc: value });
			expect(res.status, JSON.stringify(value)).toBe(400);
			expect((await res.json()).code).toBe("invalid_input");
		}
		const after = await read(entry.id);
		expect(after.version).toBe(entry.version);
		expect(after.working.mdx).toBe("First\n");
	});

	it("rejects a document larger than the limit with 413", async () => {
		const doc = {
			type: "doc",
			version: 1,
			content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(MAX_DOC_BYTES) }] }],
		};
		const res = await post({ doc });
		expect(res.status).toBe(413);
		expect((await res.json()).code).toBe("mdx_too_large");
	});

	it("accepts a document larger than the MDX limit", async () => {
		// Well above the MDX limit as JSON but within the document limit; the MDX written from it is within its own limit.
		const paragraph = { type: "paragraph", content: [{ type: "text", text: "word " }] };
		const doc = { type: "doc", version: 1, content: Array.from({ length: 60_000 }, () => paragraph) };
		expect(Buffer.byteLength(JSON.stringify(doc))).toBeGreaterThan(2 * 1024 * 1024);
		expect(Buffer.byteLength(JSON.stringify(doc))).toBeLessThan(MAX_DOC_BYTES);

		const res = await post({ doc });

		expect(res.status).toBe(201);
	});

	it("saves the document of a read back unchanged: no new version, nothing written", async () => {
		const entry = await created({ mdx: UNTIDY });
		const before = await storedRow(entry.id);
		const loaded = await read(entry.id);
		expect(loaded.working.doc).not.toBeNull();

		const res = await patch(entry.id, { expectedVersion: loaded.version, doc: loaded.working.doc });

		expect(res.status).toBe(200);
		const saved = (await res.json()) as Entry;
		expect(saved.version).toBe(loaded.version);
		expect(saved.working.contentHash).toBe(loaded.working.contentHash);
		expect(await storedRow(entry.id)).toEqual(before);
	});

	it("lists templates with their documents", async () => {
		const template = await (holder.store as typeof store).createTemplate({ name: unique("doc template"), mdx: UNTIDY });

		const res = await getTemplates(new NextRequest("http://localhost/api/cms/v1/templates"));

		const { items } = await res.json();
		const listed = items.find((item: { id: string }) => item.id === template.id);
		expect(listed.mdx).toBe(TIDY);
		expect(listed.doc).toEqual(bodyFromMdx(UNTIDY).doc);
	});
});
