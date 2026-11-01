import { describe, expect, it } from "vitest";
import { contentCollection, defaultLocale } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { docOf } from "../../../../test/stored-content";
import { overlappingZip } from "../../../../test/zip-bomb";
import type { CmsError } from "../../../core/store/errors";
import type { ExportSnapshot, MediaAssetRecord } from "../../../core/store/types";
import { MAX_IMPORT_INFLATED_BYTES } from "../../entry-import/read-archive";
import { buildExportArchive } from "../../export-service";
import { createZipArchive, readZipArchive } from "../../zip";
import { readBackupArchive } from "../read-backup";

const TIME = new Date("2026-09-22T00:00:00.000Z");
const ids = {
	published: "11111111-1111-4111-8111-111111111111",
	draft: "22222222-2222-4222-8222-222222222222",
	folder: "33333333-3333-4333-8333-333333333333",
	template: "44444444-4444-4444-8444-444444444444",
};
const mediaId = (n: number) => `5555555${n}-5555-4555-8555-555555555555`;

const body = (text: string) => ({
	metadata: { title: text },
	doc: docOf(text),
	contentHash: `hash-${text}`,
	updatedAt: TIME,
	translation: null,
});

const mediaRecord = (n: number, status: MediaAssetRecord["status"]): MediaAssetRecord => ({
	id: mediaId(n),
	folderId: null,
	status,
	filename: `file-${n}.png`,
	mimeType: "image/png",
	byteSize: 10,
	width: 1,
	height: 1,
	stagingKey: status === "ready" || status === "trashed" ? null : `staging/file-${n}.png`,
	storageKey: status === "ready" || status === "trashed" ? `media/file-${n}.png` : null,
	original: null,
	defaultAlt: "",
	defaultCaption: "",
	createdAt: TIME,
	updatedAt: TIME,
	readyAt: status === "ready" || status === "trashed" ? TIME : null,
	deletedAt: status === "trashed" ? TIME : null,
});

/**
 * What a site holds that a backup carries, with one of each kind of record a site can have: a published entry and a draft, references to an entry and to a
 * media file from both bodies, media records in every state an upload goes through, and addresses of every type (a reserved one, the current one, an old
 * one that redirects, one an entry deleted for good left).
 */
const snapshot = (): ExportSnapshot => ({
	entries: [
		{
			id: ids.published,
			collection: contentCollection,
			locale: defaultLocale,
			translationGroupId: ids.published,
			status: "published",
			version: 3,
			folderId: ids.folder,
			workingSlug: "published",
			publishedSlug: "published",
			createdAt: TIME,
			updatedAt: TIME,
			publishedAt: TIME,
			deletedAt: null,
			changedBy: null,
			changedAt: null,
			working: body("A newer draft"),
			published: body("Published"),
		},
		{
			id: ids.draft,
			collection: contentCollection,
			locale: defaultLocale,
			translationGroupId: ids.draft,
			status: "draft",
			version: 1,
			folderId: null,
			workingSlug: "draft",
			publishedSlug: null,
			createdAt: TIME,
			updatedAt: TIME,
			publishedAt: null,
			deletedAt: null,
			changedBy: null,
			changedAt: null,
			working: body("Draft"),
		},
	],
	references: (["working", "published"] as const).flatMap((state) => [
		{
			entryId: ids.published,
			state,
			kind: "entry" as const,
			targetId: ids.draft,
			isStale: false,
			occurrences: [{ type: "metadata" as const, path: "related", ordinal: 0 }],
		},
		{
			entryId: ids.published,
			state,
			kind: "media" as const,
			targetId: mediaId(1),
			isStale: false,
			occurrences: [{ type: "metadata" as const, path: "image" }],
		},
	]),
	folders: [
		{
			id: ids.folder,
			collection: contentCollection,
			parentId: null,
			name: "Notes",
			position: 0,
			version: 1,
			deletedAt: null,
		},
	],
	addresses: [
		{ collection: contentCollection, locale: defaultLocale, slug: "draft", entryId: ids.draft, type: "reservation" },
		{
			collection: contentCollection,
			locale: defaultLocale,
			slug: "published",
			entryId: ids.published,
			type: "current",
		},
		{ collection: contentCollection, locale: defaultLocale, slug: "first-name", entryId: ids.published, type: "alias" },
		{ collection: contentCollection, locale: defaultLocale, slug: "gone", entryId: null, type: "deleted" },
	],
	media: [
		mediaRecord(1, "ready"),
		mediaRecord(2, "pending"),
		mediaRecord(3, "failed"),
		mediaRecord(4, "deleting"),
		mediaRecord(5, "trashed"),
	],
	templates: [
		{ id: ids.template, name: "A template", doc: docOf("Template"), version: 1, createdAt: TIME, updatedAt: TIME },
	],
	preferences: [],
});

const backupOf = (site: ExportSnapshot) =>
	buildExportArchive(site, { site: testSite, scope: "admin", exportedAt: TIME, selection: null }).zip;

/** A zip with one file of the archive changed, or removed when `change` gives `undefined`. */
const withFile = (zip: Uint8Array, path: string, change: (current: unknown) => unknown): Uint8Array => {
	const files = readZipArchive(zip).flatMap((file) => {
		if (file.path !== path) return [file];
		const changed = change(JSON.parse(new TextDecoder().decode(file.data)));
		return changed === undefined ? [] : [{ path, data: new TextEncoder().encode(JSON.stringify(changed)) }];
	});
	return createZipArchive(files);
};

const byKey = <T>(rows: readonly T[], key: (row: T) => string) =>
	[...rows].sort((a, b) => key(a).localeCompare(key(b)));

/** The notice an archive is refused with, or `undefined` when it is read. */
const refusal = (bytes: Uint8Array) => {
	try {
		readBackupArchive(bytes);
	} catch (error) {
		return (error as CmsError).notice;
	}
	return undefined;
};

describe("readBackupArchive", () => {
	it("DATA-R1 reads back every record a backup holds, as the site had it", () => {
		const site = snapshot();
		const read = readBackupArchive(backupOf(site));
		expect(read).toMatchObject({ isBackup: true, problems: [] });
		const id = (row: { id: string }) => row.id;
		expect(byKey(read.plan.entries, id)).toEqual(byKey(site.entries, id));
		const reference = (row: (typeof site.references)[number]) => `${row.state}:${row.kind}`;
		expect(byKey(read.plan.references, reference)).toEqual(byKey(site.references, reference));
		expect(byKey(read.plan.folders, id)).toEqual(byKey(site.folders, id));
		expect(byKey(read.plan.addresses, (row) => row.slug)).toEqual(byKey(site.addresses, (row) => row.slug));
		expect(byKey(read.plan.media, id)).toEqual(byKey(site.media, id));
		expect(read.plan.templates).toEqual(site.templates);
	});

	it("DATA-R3 names each file of the backup that is missing", () => {
		const backup = backupOf(snapshot());
		// The files at the top of the archive that a restore reads: all but the manifest, and the preferences it does not restore.
		const files = readZipArchive(backup)
			.map((file) => file.path)
			.filter((path) => !path.includes("/") && path !== "manifest.json" && path !== "preferences.json");
		expect(files.length).toBeGreaterThan(0);
		for (const path of files) {
			const read = readBackupArchive(withFile(backup, path, () => undefined));
			expect(read.problems, path).toEqual([{ subject: "archive", id: null, label: path, code: "files_unreadable" }]);
		}
	});

	it("DATA-R3 names a template whose document cannot be read, and leaves it out", () => {
		const backup = withFile(backupOf(snapshot()), "templates.json", (templates) =>
			(templates as { doc: unknown }[]).map((template) => ({ ...template, doc: { type: "not a document" } })),
		);
		const read = readBackupArchive(backup);
		expect(read.problems).toEqual([
			{ subject: "template", id: ids.template, label: "A template", code: "files_unreadable" },
		]);
		expect(read.plan.templates).toEqual([]);
	});

	it("DATA-R3 names an entry the manifest lists without its fields", () => {
		const backup = withFile(backupOf(snapshot()), "manifest.json", (manifest) => {
			const { entries } = manifest as { entries: { id: string }[] };
			return {
				...(manifest as object),
				entries: entries.map((entry) => (entry.id === ids.draft ? { id: entry.id } : entry)),
			};
		});
		const read = readBackupArchive(backup);
		expect(read.problems).toEqual([{ subject: "entry", id: ids.draft, label: null, code: "files_unreadable" }]);
		expect(read.plan.entries.map((entry) => entry.id)).toEqual([ids.published]);
	});

	it("DATA-R5 refuses a file that is not a zip, and a zip with no manifest, each with its own reason", () => {
		expect(refusal(new Uint8Array([1, 2, 3]))).toEqual({ key: "import.archive.unreadable" });
		const noManifest = createZipArchive([{ path: "readme.txt", data: new TextEncoder().encode("hello") }]);
		expect(refusal(noManifest)).toEqual({ key: "restore.archive.invalid" });
	});

	it("DATA-R5 stops reading a backup whose files inflate past the limit", () => {
		expect(refusal(overlappingZip(MAX_IMPORT_INFLATED_BYTES))).toEqual({ key: "import.archive.unreadable" });
	});
});
