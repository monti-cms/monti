import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, recordRelationField, requiredMetadata } from "../../../../test/any-site";
import { paragraphsFormat } from "../../../../test/paragraphs-format";
import { testConfig, testSite } from "../../../../test/site";
import { AuthError } from "../../../adapters/auth";
import { fakeCms } from "../../../cms";
import type { ContentStore, Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { createFormatRegistry } from "../../../format/registry";
import { createContentService } from "../../../services/content-service";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
	routeCaller,
} from "../../../testing";
import { GET as contentsHandler } from "../folders/[id]/contents/route";
import { DELETE as deleteFolderHandler } from "../folders/[id]/route";
import { POST as unlinkHandler } from "../references/unlink/route";
import { POST as deleteHandler } from "../trash/delete/route";
import { POST as emptyHandler } from "../trash/empty/route";
import { POST as purgeHandler } from "../trash/purge/route";
import { POST as restoreHandler } from "../trash/restore/route";
import { GET as listHandler } from "../trash/route";

const list = routeCaller(listHandler);
const restore = routeCaller(restoreHandler);
const remove = routeCaller(deleteHandler);
const empty = routeCaller(emptyHandler);
const purge = routeCaller(purgeHandler, "admin-or-bearer");
const unlink = routeCaller(unlinkHandler);
const contents = routeCaller(contentsHandler);
const deleteFolder = routeCaller(deleteFolderHandler);

const relation = recordRelationField(contentCollection);

const request = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
	new Request(`http://localhost/api/monti/v1/${path}`, {
		method,
		headers: { origin: "http://localhost", "content-type": "application/json", ...headers },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});

/** The trash routes over a real store: the shapes the admin reads, the dates as text, and who may call what. */
describe("trash routes", () => {
	let pool: Pool;
	let schema: string;
	let store: ContentStore;
	let content: ReturnType<typeof createContentService>;
	let cms: ReturnType<typeof fakeCms>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}-${randomUUID().slice(0, 4)}`;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schema = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema });
		store = createContentStore(pool, { site: testSite, schema });
		content = createContentService(store, {
			site: testSite,
			formats: async () => createFormatRegistry([paragraphsFormat]),
		});
		cms = fakeCms({
			config: testConfig,
			store,
			mediaStore: { deleteFile: async () => undefined, getPublicUrl: (key: string) => `https://cdn.test/${key}` },
			server: { events: { retrySecret: "cron-secret" } },
		});
	});

	afterAll(async () => {
		if (pool && schema) await dropIsolatedTestPool(pool, schema);
		await closeGlobalPool();
	});

	const relationTarget = async (to: string): Promise<string> => {
		const made = (
			await content.createDraft({
				collection: to,
				slug: unique(to),
				metadata: await requiredMetadata(to, unique(`target ${to}`), relationTarget),
				format: "paragraphs",
				body: "Body",
			} as never)
		).entry;
		return (
			made.status === "published"
				? made
				: await publishDraft(testSite, store, { id: made.id, expectedVersion: made.version })
		).id;
	};

	const draft = async (title: string, folderId?: string, extra: Record<string, unknown> = {}): Promise<Entry> =>
		(
			await content.createDraft({
				collection: contentCollection,
				slug: unique("entry"),
				metadata: { ...(await requiredMetadata(contentCollection, title, relationTarget)), ...extra },
				format: "paragraphs",
				body: "Body text",
				...(folderId ? { folderId } : {}),
			} as never)
		).entry;

	it("TRASH-T4 DELETE /folders/:id trashes the folder, GET /folders/:id/contents counts before, and GET /trash lists it with dates as ISO text", async () => {
		const shelf = await store.createFolder({ collection: contentCollection, parentId: null, name: unique("Shelf") });
		const entry = await draft(unique("In shelf"), shelf.id);
		const sub = await store.createFolder({ collection: contentCollection, parentId: shelf.id, name: unique("Sub") });
		void sub;

		const before = await contents(request("GET", `folders/${shelf.id}/contents`), { cms, params: { id: shelf.id } });
		expect(await before.json()).toEqual({ entries: 1, published: 0, folders: 1, files: 0, filesInUse: 0 });

		const trashed = await deleteFolder(request("DELETE", `folders/${shelf.id}?expectedVersion=${shelf.version}`), {
			cms,
			params: { id: shelf.id },
		});
		expect(trashed.status).toBe(200);
		const result = await trashed.json();
		expect(result).toMatchObject({
			entries: 1,
			folders: 1,
			files: 0,
			kept: 0,
			folder: { id: shelf.id, type: "folder", name: shelf.name },
		});
		expect(result.entryIds).toBeUndefined();
		expect(result.folder.trashedAt).toBeUndefined();
		expect(typeof result.folder.deletedAt).toBe("string");
		expect(new Date(result.folder.expiresAt).getTime()).toBeGreaterThan(new Date(result.folder.deletedAt).getTime());

		const listed = await (await list(request("GET", "trash?pageSize=100"), { cms })).json();
		expect(listed.items.find((item: { id: string }) => item.id === shelf.id)).toMatchObject({
			type: "folder",
			entries: 1,
		});
		expect(listed.kinds[contentCollection]).toBeGreaterThanOrEqual(1);
		expect(listed.total).toBeGreaterThanOrEqual(1);

		const inside = await (await list(request("GET", `trash?folder=${shelf.id}`), { cms })).json();
		expect(inside.folder).toMatchObject({ id: shelf.id });
		expect(inside.items.map((item: { id: string }) => item.id)).toContain(entry.id);

		const bad = await list(request("GET", "trash?pageSize=7"), { cms });
		expect(bad.status).toBe(400);
	});

	it("TRASH-B4 POST /trash/restore and /trash/delete answer one result per item, in order, and reject a bad body", async () => {
		const first = await draft(unique("First"));
		const second = await draft(unique("Second"));
		await store.trashEntry({ id: first.id, expectedVersion: first.version });
		await store.trashEntry({ id: second.id, expectedVersion: second.version });

		const restored = await restore(
			request("POST", "trash/restore", {
				items: [
					{ type: "entry", id: first.id },
					{ type: "media", id: randomUUID() },
				],
			}),
			{ cms },
		);
		expect(restored.status).toBe(200);
		const { results } = await restored.json();
		expect(results[0]).toMatchObject({ type: "entry", id: first.id, ok: true });
		expect(results[1]).toMatchObject({ type: "media", ok: false, error: "not_found" });

		const deleted = await remove(request("POST", "trash/delete", { items: [{ type: "entry", id: second.id }] }), {
			cms,
		});
		expect((await deleted.json()).results).toEqual([{ type: "entry", id: second.id, ok: true }]);

		expect((await restore(request("POST", "trash/restore", { items: [] }), { cms })).status).toBe(400);
		expect((await remove(request("POST", "trash/delete", { items: [{ type: "tag", id: "x" }] }), { cms })).status).toBe(
			400,
		);
	});

	it.skipIf(!relation)(
		"TRASH-E1 POST /references/unlink then /trash/delete: a blocked delete lists its usages, unlinking clears them, empty reports what stayed",
		async () => {
			if (!relation) return;
			const target = await relationTarget(relation.to);
			const pointer = await draft(unique("Pointer"), undefined, { [relation.name]: relation.many ? [target] : target });
			await store.trashEntry({ id: target, expectedVersion: (await store.getEntry(target)).version });

			const blocked = await (
				await remove(request("POST", "trash/delete", { items: [{ type: "entry", id: target }] }), { cms })
			).json();
			expect(blocked.results[0]).toMatchObject({
				ok: false,
				error: "in_use",
				usages: [{ entryId: pointer.id, collection: contentCollection, trashed: false }],
			});

			const emptied = await (await empty(request("POST", "trash/empty", {}), { cms })).json();
			expect(emptied.kept).toEqual([
				expect.objectContaining({
					type: "entry",
					id: target,
					usages: [expect.objectContaining({ entryId: pointer.id })],
				}),
			]);

			const unlinked = await unlink(request("POST", "references/unlink", { targetIds: [target] }), { cms });
			expect(await unlinked.json()).toEqual({ entries: 1 });
			const freed = await (
				await remove(request("POST", "trash/delete", { items: [{ type: "entry", id: target }] }), { cms })
			).json();
			expect(freed.results[0]).toEqual({ type: "entry", id: target, ok: true });

			expect((await unlink(request("POST", "references/unlink", {}), { cms })).status).toBe(400);
			expect(
				(await unlink(request("POST", "references/unlink", { targetIds: [target], collection: "x" }), { cms })).status,
			).toBe(400);
		},
	);

	it("TRASH-P1 POST /trash/purge takes an admin or the events retry secret, and nobody else", async () => {
		const withToken = (token: string) =>
			request("POST", "trash/purge", undefined, { authorization: `Bearer ${token}`, origin: "" });
		const ok = await purge(withToken("cron-secret"), {
			cms: fakeCms({
				config: testConfig,
				store,
				server: { events: { retrySecret: "cron-secret" } },
				verifyAdmin: async () => {
					throw new AuthError("unauthorized", "no session");
				},
			}),
		});
		expect(ok.status).toBe(200);
		expect(await ok.json()).toEqual({ deleted: expect.any(Number), kept: expect.any(Array) });

		const guarded = fakeCms({
			config: testConfig,
			store,
			verifyAdmin: async () => {
				throw new AuthError("unauthorized", "no session");
			},
		});
		expect((await purge(withToken("guess"), { cms: guarded })).status).toBe(401);
		expect((await purge(request("POST", "trash/purge"), { cms: guarded })).status).toBe(401);
		// An admin needs no token.
		expect((await purge(request("POST", "trash/purge"), { cms })).status).toBe(200);
	});

	it("TRASH-P1 every trash route needs an admin", async () => {
		const guarded = fakeCms({
			config: testConfig,
			store,
			verifyAdmin: async () => {
				throw new AuthError("unauthorized", "no session");
			},
		});
		expect((await list(request("GET", "trash"), { cms: guarded })).status).toBe(401);
		expect((await restore(request("POST", "trash/restore", { items: [] }), { cms: guarded })).status).toBe(401);
		expect((await remove(request("POST", "trash/delete", { items: [] }), { cms: guarded })).status).toBe(401);
		expect((await empty(request("POST", "trash/empty"), { cms: guarded })).status).toBe(401);
		expect(
			(await unlink(request("POST", "references/unlink", { targetIds: [randomUUID()] }), { cms: guarded })).status,
		).toBe(401);
	});
});
