import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, recordRelationField, requiredMetadata } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import type { Collection } from "../../../core/collections";
import type { ContentStore, Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { TRASH_DAYS, type TrashItem } from "../../../core/trash";
import { paragraphsFormat } from "../../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../../format/registry";
import { createContentService } from "../../../services/content-service";
import { createMediaService } from "../../../services/media-service";
import { createTrashService, PURGE_EVERY_MS } from "../../../services/trash-service";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

const DAY = 24 * 60 * 60 * 1000;
const relation = recordRelationField(contentCollection);

/** The trash against a real database: folders, entries and media discarded and put back, listed, deleted for good, emptied, purged and unlinked. */
describe("trash", () => {
	let pool: Pool;
	let schema: string;
	let store: ContentStore;
	let content: ReturnType<typeof createContentService>;
	let trash: ReturnType<typeof createTrashService>;
	let clock = new Date();
	const deletedFiles: string[] = [];
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}-${randomUUID().slice(0, 4)}`;
	const targets = new Map<Collection, string>();

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
		const mediaStore = {
			deleteFile: async ({ key }: { key: string }) => {
				deletedFiles.push(key);
			},
			getPublicUrl: (key: string) => `https://cdn.test/${key}`,
		};
		trash = createTrashService({
			site: testSite,
			store: () => store,
			mediaStore: () => mediaStore as never,
			media: () => createMediaService({ store: () => store, mediaStore: () => mediaStore as never }),
			content: () => content,
			now: () => clock,
		});
	});

	afterAll(async () => {
		if (pool && schema) await dropIsolatedTestPool(pool, schema);
		await closeGlobalPool();
	});

	// --- fixtures ---------------------------------------------------------------------------------------------------

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		// A test may have trashed or deleted the shared target; then a new one is made.
		if (
			known &&
			(await store.getEntry(known).then(
				(entry) => entry.status === "published",
				() => false,
			))
		)
			return known;
		const draftTarget = (
			await content.createDraft({
				collection: to,
				slug: unique(to),
				metadata: await requiredMetadata(to, unique(`target ${to}`), relationTarget),
				format: "paragraphs",
				body: "Body",
			} as never)
		).entry;
		const entry =
			draftTarget.status === "published"
				? draftTarget
				: await publishDraft(testSite, store, { id: draftTarget.id, expectedVersion: draftTarget.version });
		targets.set(to, entry.id);
		return entry.id;
	};

	const folder = (name: string, parentId: string | null = null, collection: string = contentCollection) =>
		store.createFolder({ collection, parentId, name: `${name} ${unique("f")}`, position: 0 });

	/** A named folder whose name is kept exactly (for the name clash). */
	const folderNamed = (name: string, parentId: string | null = null, collection: string = contentCollection) =>
		store.createFolder({ collection, parentId, name, position: 0 });

	const draft = async (title: string, folderId?: string | null, extra: Record<string, unknown> = {}): Promise<Entry> =>
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

	const publish = async (entry: Entry): Promise<Entry> =>
		publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version });

	const readyMedia = async (filename: string, folderId: string | null = null) => {
		const asset = await store.createMediaAsset({
			filename,
			mimeType: "image/png",
			byteSize: 10,
			stagingKey: `staging/${filename}`,
			folderId,
		});
		return store.completeMediaAsset({
			id: asset.id,
			storageKey: `media/${filename}`,
			mimeType: "image/png",
			byteSize: 10,
			width: 1,
			height: 1,
		});
	};

	/** Makes an entry point at something, the way a save that tracked the reference does. */
	const point = async (
		entry: Entry,
		references: { kind: "entry" | "media"; targetId: string; type: "metadata" | "body" }[],
	): Promise<Entry> => {
		const current = await store.getEntry(entry.id);
		return store.saveWorkingWithReferences({
			entryId: entry.id,
			expectedVersion: current.version,
			snapshot: {
				collection: current.collection,
				slug: current.workingSlug,
				metadata: current.working.metadata,
				doc: current.working.doc,
				contentHash: randomUUID(),
				issues: [],
				references: [],
				imageSources: [],
			} as never,
			references: references.map((reference) => ({
				kind: reference.kind,
				targetId: reference.targetId,
				isStale: false,
				occurrences: [
					reference.type === "metadata" ? { type: "metadata", path: "tagIds", ordinal: 0 } : { type: "body" },
				],
			})),
		});
	};

	const statusOf = async (id: string) => (await store.getEntry(id)).status;
	const stampOf = async (table: "entries" | "folders" | "media_assets", id: string): Promise<Date | null> =>
		(await pool.query(`SELECT deleted_at FROM "${schema}".${table} WHERE id = $1`, [id])).rows[0]?.deleted_at ?? null;
	const eventKinds = async (id: string) =>
		(await pool.query(`SELECT kind FROM "${schema}".cms_events WHERE entry_id = $1 ORDER BY seq`, [id])).rows.map(
			(row) => row.kind as string,
		);
	/** Makes everything a trash action stamped look as if it happened `days` ago. */
	const age = async (folderId: string, days: number) => {
		const stamp = (await stampOf("folders", folderId)) as Date;
		const old = new Date(stamp.getTime() - days * DAY);
		for (const table of ["entries", "folders", "media_assets"]) {
			await pool.query(`UPDATE "${schema}".${table} SET deleted_at = $2 WHERE deleted_at = $1`, [stamp, old]);
		}
	};
	const topUnits = async () => (await trash.list({ pageSize: 100 })).items;
	const unitOf = (items: readonly TrashItem[], id: string) => items.find((item) => item.id === id);

	// --- folders ----------------------------------------------------------------------------------------------------

	describe("a folder", () => {
		it("goes to the trash with its subfolders and entries as one unit, and comes back whole as drafts", async () => {
			const series = await folder("Series");
			const part = await folder("Part", series.id);
			const first = await draft("First", series.id);
			const second = await publish(await draft("Second", part.id));

			const result = await trash.trashFolder({ id: series.id, expectedVersion: series.version });
			expect(result).toMatchObject({
				entries: 2,
				folders: 1,
				files: 0,
				kept: 0,
				folder: { id: series.id, entries: 2, folders: 1 },
			});

			expect(await statusOf(first.id)).toBe("trashed");
			expect(await statusOf(second.id)).toBe("trashed");
			// One action, one stamp, and an event for every entry it took.
			const stamps = await Promise.all([
				stampOf("folders", series.id),
				stampOf("folders", part.id),
				stampOf("entries", first.id),
				stampOf("entries", second.id),
			]);
			expect(new Set(stamps.map((stamp) => stamp?.getTime())).size).toBe(1);
			expect(await eventKinds(second.id)).toContain("trashed");
			// The folders are gone from the live list, and only the top folder is a unit of the trash.
			expect((await store.listFolders({ collection: contentCollection })).map((item) => item.id)).not.toContain(
				series.id,
			);
			const units = await topUnits();
			expect(unitOf(units, series.id)).toMatchObject({ type: "folder", entries: 2, folders: 1 });
			expect(unitOf(units, first.id)).toBeUndefined();
			expect(unitOf(units, part.id)).toBeUndefined();

			const restored = await trash.restore([{ type: "folder", id: series.id }]);
			expect(restored).toEqual([{ type: "folder", id: series.id, ok: true, folderId: series.id, recreated: false }]);
			const live = await store.listFolders({ collection: contentCollection });
			expect(live.map((item) => item.id)).toEqual(expect.arrayContaining([series.id, part.id]));
			expect(live.find((item) => item.id === part.id)?.parentId).toBe(series.id);
			expect(await store.getEntry(first.id)).toMatchObject({ status: "draft", folderId: series.id });
			// A published entry comes back as a draft, to be published again by hand.
			expect(await store.getEntry(second.id)).toMatchObject({ status: "draft", folderId: part.id });
			expect(await eventKinds(second.id)).toContain("restored");
			expect((await store.getEntry(first.id)).deletedAt).toBeUndefined();
		});

		it("leaves an entry trashed before it where it is when the folder is restored", async () => {
			const box = await folder("Box");
			const early = await draft("Early", box.id);
			const late = await draft("Late", box.id);
			const trashedEarly = await store.trashEntry({ id: early.id, expectedVersion: early.version });
			await trash.trashFolder({ id: box.id, expectedVersion: box.version });
			// The early entry keeps its own day, the folder's stamp is a different one.
			expect(await stampOf("entries", early.id)).toEqual(trashedEarly.deletedAt);
			expect(await stampOf("entries", late.id)).not.toEqual(trashedEarly.deletedAt);

			await trash.restore([{ type: "folder", id: box.id }]);
			expect(await statusOf(late.id)).toBe("draft");
			expect(await store.getEntry(early.id)).toMatchObject({ status: "trashed", folderId: box.id });
			// It is now a unit of the trash on its own, since its folder is live again.
			expect(unitOf(await topUnits(), early.id)).toMatchObject({
				type: "entry",
				path: [expect.stringContaining("Box")],
			});
		});

		it("recreates the folder path by name when one entry is restored from inside a trashed folder, and leaves the rest", async () => {
			const outer = await folder("Outer");
			const inner = await folder("Inner", outer.id);
			const kept = await draft("Stays", outer.id);
			const moved = await draft("Comes back", inner.id);
			await trash.trashFolder({ id: outer.id, expectedVersion: outer.version });

			const [result] = await trash.restore([{ type: "entry", id: moved.id }]);
			expect(result).toMatchObject({ ok: true, recreated: true });
			const placed = await store.getEntry(moved.id);
			expect(placed.status).toBe("draft");
			const live = await store.listFolders({ collection: contentCollection });
			const newInner = live.find((item) => item.id === placed.folderId);
			const newOuter = live.find((item) => item.id === newInner?.parentId);
			expect(newInner?.name).toBe(inner.name);
			expect(newOuter).toMatchObject({ name: outer.name, parentId: null });
			// The old folders and the other entry stay in the trash.
			expect(live.map((item) => item.id)).not.toContain(outer.id);
			expect(await statusOf(kept.id)).toBe("trashed");
			expect(unitOf(await topUnits(), outer.id)).toMatchObject({ type: "folder", entries: 1 });
		});

		it("merges into a live folder of the same name, and stays in the trash only if something is left in it", async () => {
			const old = await folderNamed(`Merge ${unique("m")}`);
			const early = await draft("Earlier", old.id);
			await store.trashEntry({ id: early.id, expectedVersion: early.version });
			const first = await draft("Inside", old.id);
			await trash.trashFolder({ id: old.id, expectedVersion: old.version });
			const fresh = await folderNamed(old.name);

			const [result] = await trash.restore([{ type: "folder", id: old.id }]);
			expect(result).toMatchObject({ ok: true, folderId: fresh.id });
			expect(await store.getEntry(first.id)).toMatchObject({ status: "draft", folderId: fresh.id });
			// The entry trashed earlier was not part of the action, so the old folder is kept for it, at the top.
			const leftover = unitOf(await topUnits(), old.id);
			expect(leftover).toMatchObject({ type: "folder", entries: 1, path: [] });
			expect((await store.listFolders({ collection: contentCollection })).map((item) => item.id)).not.toContain(old.id);

			// With nothing left, the folder row itself goes.
			const empty = await folderNamed(`Gone ${unique("g")}`);
			const only = await draft("Only", empty.id);
			await trash.trashFolder({ id: empty.id, expectedVersion: empty.version });
			const twin = await folderNamed(empty.name);
			await trash.restore([{ type: "folder", id: empty.id }]);
			expect(await store.getEntry(only.id)).toMatchObject({ folderId: twin.id });
			const rows = await pool.query(`SELECT 1 FROM "${schema}".folders WHERE id = $1`, [empty.id]);
			expect(rows.rowCount).toBe(0);
		});

		it("cannot hold anything new while it is in the trash, and a live folder may reuse its name", async () => {
			const gone = await folder("Gone");
			await trash.trashFolder({ id: gone.id, expectedVersion: gone.version });
			await expect(draft("Into the trash", gone.id)).rejects.toMatchObject({ code: "invalid_input" });
			await expect(
				store.createFolder({ collection: contentCollection, parentId: gone.id, name: "Sub" }),
			).rejects.toMatchObject({
				code: "invalid_input",
			});
			await expect(folderNamed(gone.name)).resolves.toMatchObject({ name: gone.name });
		});

		it("tells what it holds before it is trashed, counting live things once per translation group", async () => {
			const section = await folder("Contents");
			const sub = await folder("Sub", section.id);
			await draft("Draft", section.id);
			await publish(await draft("Public", sub.id));
			const trashed = await draft("Trashed", section.id);
			await store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });
			expect(await trash.folderContents(section.id)).toEqual({
				entries: 2,
				published: 1,
				folders: 1,
				files: 0,
				filesInUse: 0,
			});
		});
	});

	describe("a media folder", () => {
		it("goes whole when no file in it is in use, and the files come back with it", async () => {
			const diagrams = await folder("Diagrams", null, "media");
			const one = await readyMedia(`${unique("one")}.png`, diagrams.id);
			const two = await readyMedia(`${unique("two")}.png`, diagrams.id);
			expect(await trash.folderContents(diagrams.id)).toMatchObject({ files: 2, filesInUse: 0 });

			const result = await trash.trashFolder({ id: diagrams.id, expectedVersion: diagrams.version });
			expect(result).toMatchObject({ files: 2, kept: 0, folder: { id: diagrams.id, files: 2, collection: "media" } });
			expect((await store.getMediaAsset(one.id))?.status).toBe("trashed");
			// Gone from the library, the picker's lookups and the folder list.
			expect((await store.listMediaAssets({ pageSize: 100 })).items.map((item) => item.id)).not.toContain(one.id);
			expect(await store.findReadyMediaByStorageKeys({ keys: [one.storageKey as string] })).toEqual([]);
			expect((await store.listFolders({ collection: "media" })).map((item) => item.id)).not.toContain(diagrams.id);

			await trash.restore([{ type: "folder", id: diagrams.id }]);
			expect((await store.getMediaAsset(two.id))?.status).toBe("ready");
			expect((await store.listMediaAssets({ folderId: diagrams.id })).total).toBe(2);
		});

		it("keeps the folder and its files in use, and trashes only the unused files, each on its own", async () => {
			const covers = await folder("Covers", null, "media");
			const used = await readyMedia(`${unique("used")}.png`, covers.id);
			const spare = await readyMedia(`${unique("spare")}.png`, covers.id);
			await point(await draft("Uses a cover"), [{ kind: "media", targetId: used.id, type: "body" }]);
			expect(await trash.folderContents(covers.id)).toMatchObject({ files: 2, filesInUse: 1 });

			const result = await trash.trashFolder({ id: covers.id, expectedVersion: covers.version });
			expect(result).toEqual({ folder: null, entries: 0, folders: 0, files: 1, kept: 1 });
			expect((await store.getMediaAsset(used.id))?.status).toBe("ready");
			expect((await store.getMediaAsset(spare.id))?.status).toBe("trashed");
			// The folder stays, so the file is a unit at the top of the trash on its own, with the folder in its path.
			expect(unitOf(await topUnits(), spare.id)).toMatchObject({ type: "media", path: [covers.name] });

			const [back] = await trash.restore([{ type: "media", id: spare.id }]);
			expect(back).toMatchObject({ ok: true, folderId: covers.id, recreated: false });
		});

		it("puts one file back in a folder made again when its folder is in the trash", async () => {
			const stills = await folder("Stills", null, "media");
			const file = await readyMedia(`${unique("still")}.png`, stills.id);
			await trash.trashFolder({ id: stills.id, expectedVersion: stills.version });
			const [back] = await trash.restore([{ type: "media", id: file.id }]);
			expect(back).toMatchObject({ ok: true, recreated: true });
			const record = await store.getMediaAsset(file.id);
			expect(record?.status).toBe("ready");
			expect(record?.folderId).not.toBe(stills.id);
			expect(
				(await store.listFolders({ collection: "media" })).find((item) => item.id === record?.folderId)?.name,
			).toBe(stills.name);
		});
	});

	// --- media files ------------------------------------------------------------------------------------------------

	describe("a media file", () => {
		it("goes to the trash unless it is in use, comes back, and stays out of every live read meanwhile", async () => {
			const free = await readyMedia(`${unique("free")}.png`);
			const busy = await readyMedia(`${unique("busy")}.png`);
			await point(await draft("Shows a picture"), [{ kind: "media", targetId: busy.id, type: "body" }]);

			expect(await trash.trashMedia([free.id, busy.id])).toEqual({ trashed: [free.id], kept: [busy.id] });
			expect((await store.getMediaAsset(free.id))?.status).toBe("trashed");
			expect(
				(await store.listMediaAssets({ pageSize: 100, used: "unused" })).items.map((item) => item.id),
			).not.toContain(free.id);
			await expect(store.updateMediaMetadata({ id: free.id, defaultAlt: "x" })).rejects.toMatchObject({
				code: "not_found",
			});

			const item = unitOf(await topUnits(), free.id);
			expect(item).toMatchObject({
				type: "media",
				filename: free.filename,
				url: `https://cdn.test/${free.storageKey}`,
			});
			expect(await trash.restore([{ type: "media", id: free.id }])).toEqual([
				{ type: "media", id: free.id, ok: true, folderId: null, recreated: false },
			]);
			expect((await store.getMediaAsset(free.id))?.status).toBe("ready");
		});
	});

	// --- the list ---------------------------------------------------------------------------------------------------

	describe("the list", () => {
		it("shows the top of the trash, the inside of a folder, and a search through everything with the path of each thing", async () => {
			const needle = unique("needle");
			const shelf = await folder("Shelf");
			const nested = await folder("Nested", shelf.id);
			const loose = await draft(`${needle} loose`);
			const inside = await draft(`${needle} inside`, nested.id);
			const file = await readyMedia(`${needle}.png`, null);
			await store.trashEntry({ id: loose.id, expectedVersion: loose.version });
			await trash.trashFolder({ id: shelf.id, expectedVersion: shelf.version });
			await trash.trashMedia([file.id]);

			const top = await trash.list({ pageSize: 100 });
			expect(top.items.map((item) => item.id)).toEqual(expect.arrayContaining([loose.id, shelf.id, file.id]));
			expect(top.items.map((item) => item.id)).not.toContain(inside.id);
			// Kinds count the units at the top: the collection of the entry and of the folder, and the media.
			expect(top.kinds[contentCollection]).toBeGreaterThanOrEqual(2);
			expect(top.kinds.media).toBeGreaterThanOrEqual(1);
			expect(await trash.list({ kinds: ["media"], pageSize: 100 })).toMatchObject({
				items: expect.arrayContaining([expect.objectContaining({ id: file.id })]),
			});
			// Several kinds are any of them.
			const both = await trash.list({ kinds: ["media", contentCollection], pageSize: 100 });
			expect(both.items.map((item) => item.id)).toEqual(expect.arrayContaining([loose.id, shelf.id, file.id]));
			// The media kind holds files and media folders.
			expect(
				(await trash.list({ kinds: ["media"], pageSize: 100 })).items.every(
					(item) => item.type === "media" || (item.type === "folder" && item.collection === "media"),
				),
			).toBe(true);

			// Inside the folder: the direct children, counting from the folder's day, with no date of their own to expire on.
			const opened = await trash.list({ folderId: shelf.id });
			expect(opened.folder).toMatchObject({ id: shelf.id, name: shelf.name });
			expect(opened.items.map((item) => item.id)).toEqual([nested.id]);
			const nestedItem = opened.items[0];
			expect(nestedItem).toMatchObject({
				type: "folder",
				expiresAt: null,
				deletedAt: opened.folder?.deletedAt,
				path: [shelf.name],
			});
			const deeper = await trash.list({ folderId: nested.id });
			expect(deeper.items[0]).toMatchObject({ id: inside.id, expiresAt: null, deletedAt: opened.folder?.deletedAt });

			// A search reaches into folders and tells where the thing was.
			const found = await trash.list({ search: needle, pageSize: 100 });
			expect(found.items.map((item) => item.id).sort()).toEqual([file.id, inside.id, loose.id].sort());
			expect(unitOf(found.items, inside.id)).toMatchObject({
				type: "entry",
				path: [shelf.name, nested.name],
				expiresAt: null,
			});
			expect(unitOf(found.items, loose.id)).toMatchObject({ path: [] });
			expect(unitOf(found.items, loose.id)?.expiresAt).toBeInstanceOf(Date);
		});

		it("sorts by the day each was discarded, the newest first unless asked otherwise, and counts the days from the folder for what is inside", async () => {
			const early = await draft(unique("early"));
			const later = await draft(unique("later"));
			await store.trashEntry({ id: early.id, expectedVersion: early.version });
			await new Promise((resolve) => setTimeout(resolve, 5));
			await store.trashEntry({ id: later.id, expectedVersion: later.version });
			const ids = (items: readonly TrashItem[]) =>
				items.map((item) => item.id).filter((id) => id === early.id || id === later.id);
			expect(ids((await trash.list({ pageSize: 100 })).items)).toEqual([later.id, early.id]);
			expect(ids((await trash.list({ direction: "asc", pageSize: 100 })).items)).toEqual([early.id, later.id]);
			expect((await trash.list({ pageSize: 25, page: 1 })).total).toBeGreaterThanOrEqual(2);

			// An entry trashed 40 days ago and then its folder today: the entry counts from the folder.
			const box = await folder("Aged");
			const old = await draft("Old", box.id);
			await store.trashEntry({ id: old.id, expectedVersion: old.version });
			await pool.query(`UPDATE "${schema}".entries SET deleted_at = now() - interval '40 days' WHERE id = $1`, [
				old.id,
			]);
			await trash.trashFolder({ id: box.id, expectedVersion: box.version });
			const inside = await trash.list({ folderId: box.id });
			expect(inside.items[0]?.deletedAt).toEqual(inside.folder?.deletedAt);
		});

		it.skipIf(!relation)(
			"shows what an entry has: its languages, whether it was published, and how many entries point at it",
			async () => {
				if (!relation) return;
				const tag = await relationTarget(relation.to);
				const post = await publish(await draft(unique("Tagged")));
				await point(await store.getEntry(post.id), [{ kind: "entry", targetId: tag, type: "metadata" }]);
				const never = await draft(unique("Never published"));
				await store.trashEntry({ id: never.id, expectedVersion: never.version });
				const trashedPost = await store.trashEntry({
					id: post.id,
					expectedVersion: (await store.getEntry(post.id)).version,
				});
				void trashedPost;
				const items = (await trash.list({ pageSize: 100 })).items;
				expect(unitOf(items, post.id)).toMatchObject({
					type: "entry",
					everPublished: true,
					isSource: true,
					sourceTrashed: false,
				});
				expect(unitOf(items, never.id)).toMatchObject({ everPublished: false });
				// A tag that a post points at in a relation field counts that post.
				await store.trashEntry({ id: tag, expectedVersion: (await store.getEntry(tag)).version });
				const withUsage = unitOf((await trash.list({ pageSize: 100 })).items, tag);
				expect(withUsage).toMatchObject({ type: "entry" });
				if (withUsage?.type === "entry") expect(withUsage.usages).toBeGreaterThanOrEqual(1);
				await store
					.restoreEntry({ id: tag, expectedVersion: (await store.getEntry(tag)).version, snapshot: undefined })
					.catch(() => undefined);
			},
		);
	});

	describe("a translation", () => {
		const second = testSite.LOCALES.find((code) => code !== testSite.DEFAULT_LOCALE);

		it.skipIf(!second)(
			"is a language of its source's row when they were trashed together, and a row of its own when it was trashed alone",
			async () => {
				const source = await draft(unique("Source"));
				const translation = (await content.createTranslation({ sourceId: source.id, locale: second as string })).entry;
				const alone = (
					await content.createTranslation({ sourceId: (await draft(unique("Other"))).id, locale: second as string })
				).entry;

				await store.trashEntry({ id: source.id, expectedVersion: source.version });
				await store.trashEntry({ id: alone.id, expectedVersion: alone.version });

				const items = (await trash.list({ pageSize: 100 })).items;
				const row = unitOf(items, source.id);
				expect(row).toMatchObject({ type: "entry", isSource: true, locales: [testSite.DEFAULT_LOCALE, second] });
				expect(unitOf(items, translation.id)).toBeUndefined();
				expect(unitOf(items, alone.id)).toMatchObject({
					isSource: false,
					locales: [second],
					sourceTrashed: false,
					sourceTitle: expect.any(String),
				});
			},
		);

		it.skipIf(!second)("cannot come back before its source, and names the source to restore first", async () => {
			const source = await draft(unique("Parent"));
			const translation = (await content.createTranslation({ sourceId: source.id, locale: second as string })).entry;
			await store.trashEntry({ id: translation.id, expectedVersion: translation.version });
			const trashedSource = await store.trashEntry({ id: source.id, expectedVersion: source.version });
			const row = unitOf((await trash.list({ pageSize: 100 })).items, translation.id);
			expect(row).toMatchObject({ sourceTrashed: true });
			expect(await trash.restore([{ type: "entry", id: translation.id }])).toEqual([
				{ type: "entry", id: translation.id, ok: false, error: "source_trashed", sourceId: source.id },
			]);
			await trash.restore([{ type: "entry", id: source.id, expectedVersion: trashedSource.version }]);
			expect(await trash.restore([{ type: "entry", id: translation.id }])).toMatchObject([{ ok: true }]);
		});
	});

	// --- deleting for good ------------------------------------------------------------------------------------------

	describe("deleting for good", () => {
		const trashed = async (entry: Entry) =>
			store.trashEntry({ id: entry.id, expectedVersion: (await store.getEntry(entry.id)).version });

		it("is not held back by a link in a body: the reference rows go and the entry is gone", async () => {
			const target = await publish(await draft(unique("Linked")));
			const source = await draft(unique("Linker"));
			await point(source, [{ kind: "entry", targetId: target.id, type: "body" }]);
			await trashed(target);
			const [result] = await trash.delete([{ type: "entry", id: target.id }]);
			expect(result).toEqual({ type: "entry", id: target.id, ok: true });
			await expect(store.getEntry(target.id)).rejects.toMatchObject({ code: "not_found" });
			expect(
				(await pool.query(`SELECT 1 FROM "${schema}".entry_references WHERE target_id = $1`, [target.id])).rowCount,
			).toBe(0);
			// An address that was published stays reserved against reuse.
			const kept = await pool.query(`SELECT type FROM "${schema}".content_addresses WHERE slug = $1`, [
				target.publishedSlug,
			]);
			expect(kept.rows).toEqual([{ type: "deleted" }]);
		});

		it.skipIf(!relation)(
			"is held back by a relation field, naming the entries that point at it and whether they are in the trash",
			async () => {
				if (!relation) return;
				const target = await draft(unique("Pointed at"));
				const live = await draft(unique("Live pointer"));
				const gone = await draft(unique("Trashed pointer"));
				await point(live, [{ kind: "entry", targetId: target.id, type: "metadata" }]);
				await point(gone, [{ kind: "entry", targetId: target.id, type: "metadata" }]);
				await trashed(gone);
				await trashed(target);

				const [result] = await trash.delete([{ type: "entry", id: target.id }]);
				expect(result).toMatchObject({ ok: false, error: "in_use" });
				const usages = result && !result.ok ? (result.usages ?? []) : [];
				expect(usages.map((usage) => [usage.entryId, usage.trashed]).sort()).toEqual(
					[
						[live.id, false],
						[gone.id, true],
					].sort(),
				);
				expect(usages[0]).toMatchObject({ collection: contentCollection, title: expect.any(String) });
				expect(await statusOf(target.id)).toBe("trashed");
			},
		);

		it.skipIf(!relation)(
			"goes through when the entries that point at it are deleted in the same call, whatever the order",
			async () => {
				if (!relation) return;
				const target = await draft(unique("Target"));
				const pointer = await draft(unique("Pointer"));
				await point(pointer, [{ kind: "entry", targetId: target.id, type: "metadata" }]);
				await trashed(pointer);
				await trashed(target);

				const results = await trash.delete([
					{ type: "entry", id: target.id },
					{ type: "entry", id: pointer.id },
				]);
				expect(results).toEqual([
					{ type: "entry", id: target.id, ok: true },
					{ type: "entry", id: pointer.id, ok: true },
				]);
				await expect(store.getEntry(target.id)).rejects.toMatchObject({ code: "not_found" });
				await expect(store.getEntry(pointer.id)).rejects.toMatchObject({ code: "not_found" });
			},
		);

		it("deletes a folder with everything in it, its media files included", async () => {
			const crate = await folder("Crate");
			const sub = await folder("Sub", crate.id);
			const inside = await publish(await draft(unique("Inside"), sub.id));
			const picture = await readyMedia(`${unique("crate")}.png`, null);
			const mediaFolder = await folder("Crate pictures", null, "media");
			const filed = await readyMedia(`${unique("filed")}.png`, mediaFolder.id);
			void picture;
			await trash.trashFolder({ id: crate.id, expectedVersion: crate.version });
			await trash.trashFolder({ id: mediaFolder.id, expectedVersion: mediaFolder.version });

			const results = await trash.delete([
				{ type: "folder", id: crate.id },
				{ type: "folder", id: mediaFolder.id },
			]);
			expect(results.every((result) => result.ok)).toBe(true);
			await expect(store.getEntry(inside.id)).rejects.toMatchObject({ code: "not_found" });
			expect(
				(await pool.query(`SELECT 1 FROM "${schema}".folders WHERE id = ANY($1)`, [[crate.id, sub.id, mediaFolder.id]]))
					.rowCount,
			).toBe(0);
			expect(await store.getMediaAsset(filed.id)).toBeNull();
			expect(deletedFiles).toContain(filed.storageKey);
			expect(await eventKinds(inside.id)).toContain("deleted");
		});

		it.skipIf(!relation)("holds a folder back when an entry outside it points at something inside", async () => {
			if (!relation) return;
			const crate = await folder("Held");
			const target = await draft(unique("Inside"), crate.id);
			const outside = await draft(unique("Outside"));
			await point(outside, [{ kind: "entry", targetId: target.id, type: "metadata" }]);
			await trash.trashFolder({ id: crate.id, expectedVersion: crate.version });
			const [result] = await trash.delete([{ type: "folder", id: crate.id }]);
			expect(result).toMatchObject({ ok: false, error: "in_use", usages: [{ entryId: outside.id, trashed: false }] });
			expect(unitOf(await topUnits(), crate.id)).toBeDefined();
		});

		it("deletes a media file from the store as well as its row, and refuses one an entry still uses", async () => {
			const file = await readyMedia(`${unique("bye")}.png`);
			await trash.trashMedia([file.id]);
			const [result] = await trash.delete([{ type: "media", id: file.id }]);
			expect(result).toMatchObject({ ok: true });
			expect(deletedFiles).toContain(file.storageKey);
			expect(await store.getMediaAsset(file.id)).toBeNull();

			// A reference saved to a file while it was in the trash holds it back.
			const late = await readyMedia(`${unique("late")}.png`);
			await trash.trashMedia([late.id]);
			await point(await draft(unique("Late use")), [{ kind: "media", targetId: late.id, type: "body" }]);
			const [held] = await trash.delete([{ type: "media", id: late.id }]);
			expect(held).toMatchObject({ ok: false, error: "in_use" });
			expect((await store.getMediaAsset(late.id))?.status).toBe("trashed");
		});

		it("deletes a source with its translations, and refuses a stale version", async () => {
			const source = await draft(unique("Versioned"));
			const trashedSource = await trashed(source);
			const [stale] = await trash.delete([
				{ type: "entry", id: source.id, expectedVersion: trashedSource.version - 1 },
			]);
			expect(stale).toMatchObject({ ok: false, error: "conflict" });
			const [fresh] = await trash.delete([{ type: "entry", id: source.id, expectedVersion: trashedSource.version }]);
			expect(fresh).toMatchObject({ ok: true });
		});
	});

	// --- empty and purge --------------------------------------------------------------------------------------------

	describe("emptying and the purge", () => {
		it("purges a folder 30 days after the folder's day, not the day its entries were trashed, and deletes media files from the store", async () => {
			const old = await folder("Old shelf");
			const entry = await draft(unique("Old entry"), old.id);
			const mediaFolder = await folder("Old pictures", null, "media");
			const file = await readyMedia(`${unique("old")}.png`, mediaFolder.id);
			await trash.trashFolder({ id: old.id, expectedVersion: old.version });
			await trash.trashFolder({ id: mediaFolder.id, expectedVersion: mediaFolder.version });

			// Not yet: 29 days.
			await age(old.id, TRASH_DAYS - 1);
			await age(mediaFolder.id, TRASH_DAYS - 1);
			expect(await trash.purge()).toMatchObject({ deleted: expect.any(Number) });
			expect(await statusOf(entry.id)).toBe("trashed");

			await age(old.id, 2);
			await age(mediaFolder.id, 2);
			const result = await trash.purge();
			expect(result.deleted).toBeGreaterThanOrEqual(2);
			await expect(store.getEntry(entry.id)).rejects.toMatchObject({ code: "not_found" });
			expect(await store.getMediaAsset(file.id)).toBeNull();
			expect(deletedFiles).toContain(file.storageKey);
		});

		it("keeps an expired unit that an entry still points at, and says why", async () => {
			if (!relation) return;
			const target = await draft(unique("Needed"));
			const pointer = await draft(unique("Needs it"));
			await point(pointer, [{ kind: "entry", targetId: target.id, type: "metadata" }]);
			const shelf = await folder("Needed shelf");
			await store.updateFolder({ id: shelf.id, name: shelf.name });
			const held = await draft(unique("Held"), shelf.id);
			await point(pointer, [
				{ kind: "entry", targetId: target.id, type: "metadata" },
				{ kind: "entry", targetId: held.id, type: "metadata" },
			]);
			await trash.trashFolder({
				id: shelf.id,
				expectedVersion: (await store.listFolders({ collection: contentCollection })).find((f) => f.id === shelf.id)
					?.version,
			});
			await age(shelf.id, TRASH_DAYS + 1);
			const result = await trash.purge();
			expect(result.kept).toEqual([
				expect.objectContaining({
					type: "folder",
					id: shelf.id,
					usages: [expect.objectContaining({ entryId: pointer.id })],
				}),
			]);
			expect(unitOf(await topUnits(), shelf.id)).toBeDefined();
		});

		it("purges when the trash is looked at, at most once a day", async () => {
			const shelf = await folder("Lazy purge");
			await draft(unique("Lazy"), shelf.id);
			await trash.trashFolder({ id: shelf.id, expectedVersion: shelf.version });
			await age(shelf.id, TRASH_DAYS + 1);
			clock = new Date(clock.getTime() + 3 * PURGE_EVERY_MS);
			await trash.list({});
			expect(unitOf(await topUnits(), shelf.id)).toBeUndefined();

			// The next look within the day does not purge again.
			const again = await folder("Lazy again");
			await trash.trashFolder({ id: again.id, expectedVersion: again.version });
			await age(again.id, TRASH_DAYS + 1);
			await trash.list({});
			expect(unitOf(await topUnits(), again.id)).toBeDefined();
			clock = new Date(clock.getTime() + 2 * PURGE_EVERY_MS);
			await trash.list({});
			expect(unitOf(await topUnits(), again.id)).toBeUndefined();
		});

		it("empties the trash and keeps what an entry points at", async () => {
			if (!relation) return;
			const shelf = await folder("To empty");
			await draft(unique("Gone"), shelf.id);
			await trash.trashFolder({ id: shelf.id, expectedVersion: shelf.version });
			const needed = await draft(unique("Still needed"));
			const pointer = await draft(unique("Pointer"));
			await point(pointer, [{ kind: "entry", targetId: needed.id, type: "metadata" }]);
			await store.trashEntry({ id: needed.id, expectedVersion: needed.version });

			const result = await trash.empty();
			expect(result.deleted).toBeGreaterThanOrEqual(1);
			expect(result.kept.map((kept) => kept.id)).toContain(needed.id);
			expect(result.kept.find((kept) => kept.id === needed.id)).toMatchObject({
				type: "entry",
				usages: [{ entryId: pointer.id, trashed: false }],
			});
			expect((await trash.list({ pageSize: 100 })).items.map((item) => item.id)).toEqual(
				result.kept.map((kept) => kept.id),
			);
			expect(unitOf(await topUnits(), shelf.id)).toBeUndefined();
		});
	});

	// --- unlink -----------------------------------------------------------------------------------------------------

	describe.skipIf(!relation)("unlinking", () => {
		const field = relation as NonNullable<typeof relation>;

		it("takes a target out of the relation fields of the other entries, working and published, bumping each version once and recording an event", async () => {
			const tag = await relationTarget(field.to);
			const extra = (
				await content.createDraft({
					collection: field.to,
					slug: unique("keep"),
					metadata: await requiredMetadata(field.to, unique("Keep tag"), relationTarget),
					format: "paragraphs",
					body: "",
				} as never)
			).entry;
			const value = (ids: string[]) => (field.many ? ids : ids[0]);
			const post = await publish(await draft(unique("Both bodies"), null, { [field.name]: value([tag, extra.id]) }));
			const onlyDraft = await draft(unique("Draft only"), null, { [field.name]: value([tag]) });
			const before = await store.getEntry(post.id);
			const eventsBefore = (await eventKinds(post.id)).length;

			const outcome = await trash.unlink({ targetIds: [tag] });
			expect(outcome.entries).toBeGreaterThanOrEqual(2);

			const after = await store.getEntry(post.id);
			const idsOf = (metadata: Record<string, unknown>) => ([] as unknown[]).concat(metadata[field.name] ?? []);
			expect(idsOf(after.working.metadata as never)).not.toContain(tag);
			expect(idsOf(after.published?.metadata as never)).not.toContain(tag);
			if (field.many) expect(idsOf(after.working.metadata as never)).toContain(extra.id);
			expect(after.version).toBe(before.version + 1);
			expect(after.working.contentHash).not.toBe(before.working.contentHash);
			expect((await eventKinds(post.id)).slice(eventsBefore)).toEqual(["saved"]);
			const refs = await store.getWorkingReferences({ entryId: post.id });
			expect(refs.map((ref) => ref.targetId)).not.toContain(tag);
			expect(idsOf((await store.getEntry(onlyDraft.id)).working.metadata as never)).not.toContain(tag);
			// Nothing points at it any more, so it can be deleted for good.
			const trashedTag = await store.trashEntry({ id: tag, expectedVersion: (await store.getEntry(tag)).version });
			const [result] = await trash.delete([{ type: "entry", id: tag, expectedVersion: trashedTag.version }]);
			expect(result).toMatchObject({ ok: true });
			targets.delete(field.to);
		});

		it("unlinks every entry of a collection, and leaves the entries that are targets themselves alone", async () => {
			const one = await relationTarget(field.to);
			const post = await draft(unique("Pointing"), null, { [field.name]: field.many ? [one] : one });
			const outcome = await trash.unlink({ collection: field.to });
			expect(outcome.entries).toBeGreaterThanOrEqual(1);
			const after = await store.getEntry(post.id);
			expect(
				([] as unknown[]).concat((after.working.metadata as Record<string, unknown>)[field.name] ?? []),
			).not.toContain(one);
			targets.delete(field.to);
			// Run again: nothing is left to unlink.
			expect(await trash.unlink({ collection: field.to })).toEqual({ entries: 0 });
		});
	});

	describe("an item", () => {
		it.skipIf(!relation)("goes to the trash while an entry uses it, and restoring it publishes it again", async () => {
			if (!relation) return;
			const tag = await relationTarget(relation.to);
			await draft(unique("User"), null, { [relation.name]: relation.many ? [tag] : tag });
			const entry = await store.getEntry(tag);
			await store.trashEntry({ id: tag, expectedVersion: entry.version });
			expect(await statusOf(tag)).toBe("trashed");
			const [result] = await trash.restore([{ type: "entry", id: tag }]);
			expect(result).toMatchObject({ ok: true });
			expect(await statusOf(tag)).toBe("published");
		});
	});
});
