import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../test/site";
import { fakeCms } from "../../cms";
import type { ContentStore } from "../../core/store";
import { emptyStoredDocument } from "../../doc/stored-document";
import { paragraphsFormat } from "../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../format/registry";
import { POST as restoreBackup, GET as restoreState } from "../../http/v1/import/restore/route";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
	routeCaller,
} from "../../testing";
import { createContentService } from "../content-service";
import { buildExportArchive, planExport } from "../export-service";
import { readBackupArchive } from "../restore/read-backup";
import { createZipArchive, readZipArchive } from "../zip";

const post = routeCaller(restoreBackup, "admin-upload");
const state = routeCaller(restoreState, "admin-upload");
const encode = (value: unknown) => new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value));
const decode = (data: Uint8Array) => new TextDecoder().decode(data);

interface TestSite {
	pool: Pool;
	schemaName: string;
	store: ContentStore;
	service: ReturnType<typeof createContentService>;
	cms: ReturnType<typeof fakeCms>;
}

/** A site over a schema of its own: the real store and the real write pipeline. */
async function makeSite(mediaStore?: { headFile: (input: { key: string }) => Promise<unknown> }): Promise<TestSite> {
	const { pool, schemaName } = await createIsolatedTestPool();
	await migrateContentStore(pool, { site: testSite, schema: schemaName });
	const store = createContentStore(pool, { site: testSite, schema: schemaName });
	const registry = createFormatRegistry([paragraphsFormat]);
	const service = createContentService(store, { site: testSite, formats: async () => registry });
	const cms = fakeCms({
		config: testConfig,
		store,
		contentService: service as never,
		formats: [paragraphsFormat],
		...(mediaStore ? { mediaStore: mediaStore as never } : {}),
	});
	return { pool, schemaName, store, service, cms };
}

const upload = (zip: Uint8Array, mode: "preview" | "run") => {
	const form = new FormData();
	form.set("file", new File([zip as BlobPart], "backup.zip", { type: "application/zip" }));
	form.set("mode", mode);
	return new Request("http://localhost/api/monti/v1/import/restore", {
		method: "POST",
		headers: { origin: "http://localhost", host: "localhost" },
		body: form,
	});
};

const preview = async (site: TestSite, zip: Uint8Array) => {
	const response = await post(upload(zip, "preview"), { cms: site.cms });
	expect(response.status).toBe(200);
	return response.json();
};

const run = (site: TestSite, zip: Uint8Array) => post(upload(zip, "run"), { cms: site.cms });

/** What a table holds, in a fixed order, for comparing two sites. */
const rows = async (site: TestSite, query: string) =>
	(await site.pool.query(query.replaceAll("$S", `"${site.schemaName}"`))).rows;

const counts = (site: TestSite) => site.store.countSiteContent();

/** A zip with one file of the archive changed. */
const withFile = (zip: Uint8Array, path: string, change: (current: Record<string, unknown>) => unknown): Uint8Array => {
	const files = readZipArchive(zip).map((file) =>
		file.path === path ? { path, data: encode(change(JSON.parse(decode(file.data)))) } : file,
	);
	return createZipArchive(files);
};

describe("restoring a backup (POST /v1/import/restore)", () => {
	let source: TestSite;
	let target: TestSite;
	const ids: Record<string, string> = {};
	let backup: Uint8Array;

	const backupOf = async (site: TestSite, ids?: string[]) => {
		const plan = planExport(await site.store.readExportSnapshot(), { scope: "admin", ...(ids ? { ids } : {}) });
		return buildExportArchive(plan.snapshot, {
			site: testSite,
			scope: "admin",
			exportedAt: new Date(),
			selection: plan.selection,
		}).zip;
	};

	beforeAll(async () => {
		source = await makeSite();
		const draft = (slug: string, title: string, extra: Record<string, unknown> = {}) =>
			source.service
				.createDraft({
					collection: "memo",
					slug,
					metadata: { title, ...extra },
					format: "paragraphs",
					body: `Body of ${title}`,
				} as never)
				.then((result) => result.entry);
		const save = (id: string, version: number, slug: string, title: string, body: string, extra = {}) =>
			source.service
				.saveDraft(id, {
					collection: "memo",
					slug,
					metadata: { title, ...extra },
					format: "paragraphs",
					body,
					expectedVersion: version,
				} as never)
				.then((result) => result.entry);

		const tag = (
			await source.service.createDraft({
				collection: "tag",
				slug: "a-tag",
				metadata: { title: "A tag" },
				doc: emptyStoredDocument(),
			} as never)
		).entry;
		ids.tag = tag.id;

		// A folder tree and a media folder.
		const parent = await source.store.createFolder({ collection: "memo", parentId: null, name: "Notes" });
		const child = await source.store.createFolder({ collection: "memo", parentId: parent.id, name: "Old" });
		const mediaFolder = await source.store.createFolder({ collection: "media", parentId: null, name: "Photos" });
		ids.child = child.id;
		ids.mediaFolder = mediaFolder.id;

		// "alpha": published, renamed (so it has an alias), then edited again (its draft differs from what is published).
		const alpha = await draft("alpha", "Alpha", { tagIds: [tag.id] });
		ids.alpha = alpha.id;
		const alphaSaved = await save(alpha.id, alpha.version, "alpha", "Alpha", "Alpha, first published body", {
			tagIds: [tag.id],
		});
		const alphaPublished = await source.service.publish({ id: alpha.id, expectedVersion: alphaSaved.version });
		const renamed = await save(
			alpha.id,
			alphaPublished.entry.version,
			"alpha-renamed",
			"Alpha renamed",
			"Alpha, renamed body",
			{ tagIds: [tag.id] },
		);
		const republished = await source.service.publish({ id: alpha.id, expectedVersion: renamed.version });
		await save(alpha.id, republished.entry.version, "alpha-renamed", "Alpha renamed", "Alpha, a newer draft", {
			tagIds: [tag.id],
		});
		const translation = (await source.service.createTranslation({ sourceId: alpha.id, locale: "en" })).entry;
		ids.translation = translation.id;
		await save(translation.id, translation.version, "alpha-renamed", "Alpha in English", "English body");

		// A draft in a folder, a trashed entry and an archived one.
		const inFolder = await draft("in-folder", "In a folder");
		await source.service.saveDraft(inFolder.id, {
			collection: "memo",
			slug: "in-folder",
			metadata: { title: "In a folder" },
			format: "paragraphs",
			body: "Body of In a folder",
			expectedVersion: inFolder.version,
			folderId: child.id,
		} as never);
		ids.inFolder = inFolder.id;
		const trashed = await draft("trashed", "Trashed");
		await source.store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });
		ids.trashed = trashed.id;
		const archived = await draft("archived", "Archived");
		await source.store.archiveEntry({ id: archived.id, expectedVersion: archived.version });
		ids.archived = archived.id;

		// A media record that is registered (not uploaded), with an alt text, a caption and a folder.
		const created = await source.store.createMediaAsset({
			filename: "photo.png",
			mimeType: "image/png",
			byteSize: 1234,
			stagingKey: "staging/photo.png",
			folderId: mediaFolder.id,
		});
		await source.store.completeMediaAsset({
			id: created.id,
			storageKey: "media/photo.png",
			mimeType: "image/png",
			byteSize: 1234,
			width: 20,
			height: 10,
		});
		await source.store.updateMediaMetadata({ id: created.id, defaultAlt: "A photo", defaultCaption: "Taken today" });
		ids.media = created.id;

		// A media folder in the trash with a file in it: both keep the time they were discarded.
		const retired = await source.store.createFolder({ collection: "media", parentId: null, name: "Retired" });
		const retiredFile = await source.store.createMediaAsset({
			filename: "old.png",
			mimeType: "image/png",
			byteSize: 10,
			stagingKey: "staging/old.png",
			folderId: retired.id,
		});
		await source.store.completeMediaAsset({
			id: retiredFile.id,
			storageKey: "media/old.png",
			mimeType: "image/png",
			byteSize: 10,
			width: 1,
			height: 1,
		});
		await source.store.trashFolder({ id: retired.id });
		ids.retired = retired.id;
		ids.retiredFile = retiredFile.id;

		await source.store.createTemplate({ name: "Custom template", doc: emptyStoredDocument() });
		backup = await backupOf(source);
	});

	beforeEach(async () => {
		if (target) await dropIsolatedTestPool(target.pool, target.schemaName);
		target = await makeSite();
	});

	afterAll(async () => {
		if (target) await dropIsolatedTestPool(target.pool, target.schemaName);
		if (source) await dropIsolatedTestPool(source.pool, source.schemaName);
		await closeGlobalPool();
	});

	it("tells whether the site is empty before a file is chosen", async () => {
		const empty = await state(new Request("http://localhost/api/monti/v1/import/restore"), { cms: target.cms });
		expect(await empty.json()).toMatchObject({ empty: true, entries: 0, folders: 0, media: 0 });
		const full = await state(new Request("http://localhost/api/monti/v1/import/restore"), { cms: source.cms });
		expect(await full.json()).toMatchObject({ empty: false });
	});

	it("previews the counts, the warnings and what is not restored, and writes nothing", async () => {
		const body = await preview(target, backup);
		expect(body).toMatchObject({ mode: "preview", ready: true, isBackup: true, empty: true, problems: [] });
		expect(body.counts).toMatchObject({
			entries: 6,
			byStatus: { draft: 2, published: 2, archived: 1, trashed: 1 },
			translations: 1,
			folders: 4,
			media: 2,
		});
		// The old address of the renamed entry, and its current one.
		expect(body.counts.aliases).toBe(1);
		expect(body.notRestored.map((item: { code: string }) => item.code)).toEqual([
			"preferences",
			"accounts",
			"api_keys",
			"ai_connections",
			"event_logs",
			"plugins",
		]);
		for (const item of body.notRestored) expect(item.text).toBeTruthy();
		// No storage in this site: the files cannot be checked, and it says so.
		expect(body.warnings.map((warning: { code: string }) => warning.code)).toEqual(["files_not_checked"]);
		expect(await counts(target)).toEqual({ entries: 0, folders: 0, media: 0 });
	});

	it("restores a seeded site into an empty one exactly as it was", async () => {
		const response = await run(target, backup);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({ mode: "run", counts: { entries: 6, translations: 1, folders: 4, media: 2 } });

		const was = await source.store.readExportSnapshot();
		const now = await target.store.readExportSnapshot();
		// Ids, versions, statuses, dates, both bodies, locales, translation groups and translation state.
		expect(now.entries).toEqual(was.entries);
		expect(now.references).toEqual(was.references);
		expect(now.folders).toEqual(was.folders);
		expect(now.addresses).toEqual(was.addresses);
		// Media records keep their ids, storage keys, alt and caption.
		expect(now.media).toEqual(was.media);
		expect(now.media.find((asset) => asset.id === ids.media)).toMatchObject({
			id: ids.media,
			storageKey: "media/photo.png",
			defaultAlt: "A photo",
			defaultCaption: "Taken today",
			folderId: ids.mediaFolder,
		});

		// What was in the trash stays in the trash, with the day it went there.
		const retiredFolder = now.folders.find((folder) => folder.id === ids.retired);
		const retiredFile = now.media.find((asset) => asset.id === ids.retiredFile);
		expect(retiredFolder?.deletedAt).toBeInstanceOf(Date);
		expect(retiredFile).toMatchObject({ status: "trashed", folderId: ids.retired });
		expect(retiredFile?.deletedAt).toEqual(retiredFolder?.deletedAt);

		// The statuses of the four kinds, the draft that differs from the published body, and the translation.
		const byId = new Map(now.entries.map((entry) => [entry.id, entry]));
		expect(byId.get(ids.trashed)?.status).toBe("trashed");
		expect(byId.get(ids.trashed)?.deletedAt).toBeInstanceOf(Date);
		expect(byId.get(ids.archived)?.status).toBe("archived");
		expect(byId.get(ids.alpha)?.status).toBe("published");
		expect(byId.get(ids.alpha)?.working.contentHash).not.toBe(byId.get(ids.alpha)?.published?.contentHash);
		expect(byId.get(ids.translation)?.translationGroupId).toBe(ids.alpha);
		expect(byId.get(ids.inFolder)?.folderId).toBe(ids.child);

		// The old address still redirects to the entry, as it did.
		const lookup = (store: ContentStore) =>
			store.getPublishedEntryBySlug({ collection: "memo", slug: "alpha", includeBody: true });
		expect(await lookup(target.store)).toEqual(await lookup(source.store));
		expect(await lookup(target.store)).toMatchObject({ status: "alias" });

		// The derived tables: the search text of each body and the reference index are the same as the source's.
		const searchText = "select entry_id, state, search_text from $S.entry_bodies order by entry_id, state";
		expect(await rows(target, searchText)).toEqual(await rows(source, searchText));
		const index =
			"select entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences from $S.entry_references order by 1, 2, 3, 4";
		expect(await rows(target, index)).toEqual(await rows(source, index));
		expect((await rows(target, index)).length).toBeGreaterThan(0);

		// No event was written, so no subscriber is notified.
		expect(await rows(target, "select count(*)::int as n from $S.cms_events")).toEqual([{ n: 0 }]);

		// The seeded templates stay, and the archive's custom template is added.
		const names = (await target.store.listTemplates()).map((template) => template.name);
		expect(names).toContain("Custom template");
		expect(names.length).toBe((await source.store.listTemplates()).length);
		expect(body.counts.templatesAdded).toBe(1);
	});

	it("refuses a site that already has content, in the preview and in the run", async () => {
		const previewed = await preview(source, backup);
		expect(previewed).toMatchObject({ ready: false, empty: false });
		const before = await counts(source);
		const response = await run(source, backup);
		expect(response.status).toBe(409);
		expect((await response.json()).error.code).toBe("conflict");
		expect(await counts(source)).toEqual(before);

		// Restoring twice: the second one is refused as not empty.
		expect((await run(target, backup)).status).toBe(200);
		expect((await run(target, backup)).status).toBe(409);
	});

	it("checks the site is empty again inside the transaction", async () => {
		const plan = readBackupArchive(backup).plan;
		await target.store.restoreArchive(plan);
		await expect(target.store.restoreArchive(plan)).rejects.toMatchObject({ code: "conflict" });
	});

	it("refuses a selection and points to Import entries", async () => {
		const selection = await backupOf(source, [ids.alpha as string]);
		const body = await preview(target, selection);
		expect(body).toMatchObject({ ready: false, isBackup: false });
		expect(body.refusal.text).toBeTruthy();
		expect(body.refusal.fix).toBeTruthy();
		const response = await run(target, selection);
		expect(response.status).toBe(400);
		expect(await counts(target)).toEqual({ entries: 0, folders: 0, media: 0 });
	});

	it("refuses a public archive", async () => {
		const plan = planExport(await source.store.readExportSnapshot(), { scope: "public" });
		const zip = buildExportArchive(plan.snapshot, {
			site: testSite,
			scope: "public",
			exportedAt: new Date(),
			selection: plan.selection,
		}).zip;
		expect(await preview(target, zip)).toMatchObject({ ready: false, isBackup: false });
		expect((await run(target, zip)).status).toBe(400);
	});

	it("refuses a file that is not a backup", async () => {
		const notZip = new Uint8Array([1, 2, 3]);
		expect((await run(target, notZip)).status).toBe(400);
		const noManifest = createZipArchive([{ path: "readme.txt", data: encode("hello") }]);
		expect((await run(target, noManifest)).status).toBe(400);
	});

	it("lists every schema problem per entry and writes nothing", async () => {
		// The draft of "alpha" has a title longer than the schema allows, the published body of another entry lost its title.
		let tampered = withFile(backup, `entries/memo/${ids.alpha}/working.json`, (file) => ({
			...file,
			metadata: { ...(file.metadata as object), title: "x".repeat(300) },
		}));
		tampered = withFile(tampered, `entries/memo/${ids.alpha}/published.json`, (file) => ({
			...file,
			metadata: { tagIds: (file.metadata as { tagIds?: string[] }).tagIds },
		}));
		// A folder and a media record that are not in the archive.
		tampered = withFile(tampered, "folders.json", (folders) =>
			(folders as unknown as { id: string }[]).filter((folder) => folder.id !== ids.child),
		);

		const body = await preview(target, tampered);
		expect(body.ready).toBe(false);
		const codes = body.problems.map((problem: { code: string; id: string }) => `${problem.code}:${problem.id}`);
		expect(codes).toContain(`body_invalid:${ids.alpha}`);
		expect(codes).toContain(`publish_invalid:${ids.alpha}`);
		expect(codes).toContain(`folder_missing:${ids.inFolder}`);
		const alpha = body.problems.find((problem: { code: string }) => problem.code === "body_invalid");
		expect(alpha.found.length).toBeGreaterThan(0);
		expect(alpha.label).toBeTruthy();

		const response = await run(target, tampered);
		expect(response.status).toBe(422);
		const error = (await response.json()).error;
		expect(error.details.problems.length).toBe(body.problems.length);
		// Nothing was written, not even the entries that were fine.
		expect(await counts(target)).toEqual({ entries: 0, folders: 0, media: 0 });
		expect(await rows(target, "select count(*)::int as n from $S.content_addresses")).toEqual([{ n: 0 }]);
	});

	it("refuses a translation whose source is not in the archive", async () => {
		const tampered = withFile(backup, "manifest.json", (manifest) => ({
			...manifest,
			entries: (manifest.entries as { id: string }[]).filter((entry) => entry.id !== ids.alpha),
		}));
		const body = await preview(target, tampered);
		expect(body.ready).toBe(false);
		expect(body.problems.map((problem: { code: string }) => problem.code)).toContain("source_missing");
	});

	it("writes nothing when the transaction fails part-way", async () => {
		const read = readBackupArchive(backup);
		// A reference to a media record that does not exist: the foreign key refuses it after the folders, media, entries and addresses went in.
		const plan = {
			...read.plan,
			references: [
				...read.plan.references,
				{
					entryId: ids.alpha as string,
					state: "working",
					kind: "media",
					targetId: "99999999-9999-4999-8999-999999999999",
					isStale: false,
					occurrences: [],
				},
			],
		};
		await expect(target.store.restoreArchive(plan)).rejects.toThrow();
		expect(await counts(target)).toEqual({ entries: 0, folders: 0, media: 0 });
		for (const table of ["entry_bodies", "content_addresses", "entry_references", "cms_events"]) {
			expect(await rows(target, `select count(*)::int as n from $S.${table}`), table).toEqual([{ n: 0 }]);
		}
		// The seeded templates are as they were, and the site can still take the backup.
		expect((await target.store.listTemplates()).map((template) => template.name)).not.toContain("Custom template");
		expect((await run(target, backup)).status).toBe(200);
	});

	it("skips a template whose id or name the site already has, and says so", async () => {
		const custom = (await source.store.listTemplates()).find((template) => template.name === "Custom template");
		if (!custom) throw new Error("the source has no custom template");
		// The target has a template with the custom one's id (another name). The seeded templates have the same ids on both sites.
		await target.pool.query(
			`insert into "${target.schemaName}".body_templates (id, name, version, created_at, updated_at, doc) values ($1, 'Same id, other name', 1, now(), now(), $2)`,
			[custom.id, JSON.stringify(emptyStoredDocument())],
		);
		const before = (await target.store.listTemplates()).length;

		const body = await preview(target, backup);
		expect(body.ready).toBe(true);
		const skipped = body.counts.templatesSkipped as { id: string; reason: string; text: string }[];
		expect(skipped.find((item) => item.id === custom.id)).toMatchObject({ reason: "id" });
		expect(skipped.length).toBe((await source.store.listTemplates()).length);
		expect(body.counts.templatesAdded).toBe(0);
		for (const item of skipped) expect(item.text).toBeTruthy();

		const response = await run(target, backup);
		expect(response.status).toBe(200);
		expect((await response.json()).counts.templatesSkipped).toHaveLength(skipped.length);
		expect((await target.store.listTemplates()).length).toBe(before);
		expect((await target.store.listTemplates()).find((template) => template.id === custom.id)?.name).toBe(
			"Same id, other name",
		);
	});

	it("skips a template whose name the site already has under another id", async () => {
		await target.pool.query(
			`insert into "${target.schemaName}".body_templates (id, name, version, created_at, updated_at, doc) values ('99999999-9999-4999-8999-999999999999', 'custom TEMPLATE', 1, now(), now(), $1)`,
			[JSON.stringify(emptyStoredDocument())],
		);
		const body = await preview(target, backup);
		expect(body.counts.templatesSkipped).toContainEqual(
			expect.objectContaining({ name: "Custom template", reason: "name" }),
		);
		expect((await run(target, backup)).status).toBe(200);
	});

	it("lists the media whose file is missing from storage as a warning, and still restores", async () => {
		const withStorage = await makeSite({ headFile: async () => null });
		try {
			const body = await preview(withStorage, backup);
			expect(body.ready).toBe(true);
			expect(body.warnings).toHaveLength(1);
			expect(body.warnings[0]).toMatchObject({ code: "media_file_missing", id: ids.media, label: "photo.png" });
			const response = await run(withStorage, backup);
			expect(response.status).toBe(200);
			expect((await response.json()).warnings).toHaveLength(1);
			expect((await withStorage.store.getMediaAsset(ids.media as string))?.storageKey).toBe("media/photo.png");

			// Files that are there are not warned about.
			const present = await makeSite({ headFile: async () => ({ size: 1 }) });
			try {
				expect((await preview(present, backup)).warnings).toEqual([]);
			} finally {
				await dropIsolatedTestPool(present.pool, present.schemaName);
			}
		} finally {
			await dropIsolatedTestPool(withStorage.pool, withStorage.schemaName);
		}
	});

	it("reports an archive file that cannot be read as a problem of its entry", async () => {
		const files = readZipArchive(backup).filter(
			(file) => file.path !== `entries/memo/${ids.inFolder}/working.doc.json`,
		);
		const body = await preview(target, createZipArchive(files));
		expect(body.ready).toBe(false);
		expect(body.problems).toContainEqual(expect.objectContaining({ code: "files_unreadable", id: ids.inFolder }));
	});
});
