import { describe, expect, it } from "vitest";
import {
	FIXTURE_CONTENT_COLLECTION as CONTENT,
	FIXTURE_LOCALE,
	FIXTURE_TIME,
	fixtureBody,
	makeExportFixtureSnapshot,
} from "../../../test/export-fixture";
import { testSite } from "../../../test/site";
import type { ExportSnapshot } from "../../core/store";
import { buildExportArchive, planExport } from "../export-service";
import { readZipArchive } from "../zip";

const POST_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const ARCHIVED_ID = "88888888-8888-4888-8888-888888888888";
const TRANSLATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DRAFT_TRANSLATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ROOT_FOLDER = "55555555-5555-4555-8555-555555555555";
const CHILD_FOLDER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_FOLDER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const IMAGE_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_IMAGE_ID = "99999999-9999-4999-8999-999999999999";

/**
 * The fixture with a translation of the public post (published, in its group), a draft translation of the same post, a folder tree the post sits in and
 * a folder it does not.
 */
const makeSnapshot = (): ExportSnapshot => {
	const snapshot = makeExportFixtureSnapshot();
	const post = snapshot.entries.find((entry) => entry.id === POST_ID);
	if (!post) throw new Error("fixture changed");
	post.folderId = CHILD_FOLDER;
	snapshot.entries.push(
		{
			...post,
			id: TRANSLATION_ID,
			locale: `${FIXTURE_LOCALE}-translated`,
			translationGroupId: POST_ID,
			workingSlug: "translated-post",
			publishedSlug: "translated-post",
			working: fixtureBody("translated working", "번역", "hash-working-t"),
			published: fixtureBody("translated published", "번역", "hash-published-t"),
		},
		{
			...post,
			id: DRAFT_TRANSLATION_ID,
			locale: `${FIXTURE_LOCALE}-draft`,
			translationGroupId: POST_ID,
			status: "draft",
			workingSlug: "draft-translation",
			publishedSlug: null,
			publishedAt: null,
			working: fixtureBody("draft translation", "초안 번역", "hash-working-d"),
			published: undefined,
		},
	);
	snapshot.folders.push(
		{ id: CHILD_FOLDER, collection: CONTENT, parentId: ROOT_FOLDER, name: "하위", position: 0, version: 1 },
		{ id: OTHER_FOLDER, collection: CONTENT, parentId: null, name: "다른", position: 1, version: 1 },
	);
	snapshot.addresses.push({
		collection: CONTENT,
		locale: `${FIXTURE_LOCALE}-translated`,
		slug: "old-translated",
		entryId: TRANSLATION_ID,
		type: "alias",
	});
	snapshot.references.push({
		entryId: TRANSLATION_ID,
		state: "published",
		kind: "media",
		targetId: OTHER_IMAGE_ID,
		isStale: false,
		occurrences: [],
	});
	return snapshot;
};

const idsOf = (snapshot: ExportSnapshot) => snapshot.entries.map((entry) => entry.id).sort();

describe("planExport", () => {
	it("DATA-B1 without ids, a backup is the whole site and the summary counts all of it", () => {
		const snapshot = makeSnapshot();
		const plan = planExport(snapshot, { scope: "admin" });

		expect(plan.selection).toBeNull();
		expect(plan.snapshot).toBe(snapshot);
		expect(plan.summary).toMatchObject({
			entries: snapshot.entries.length,
			addedByTranslations: 0,
			templates: snapshot.templates.length,
			folders: snapshot.folders.length,
			addresses: snapshot.addresses.length,
			media: snapshot.media.length,
		});
	});

	it("DATA-B4 a selection is always expanded to the whole translation groups of the entries", () => {
		const plan = planExport(makeSnapshot(), { scope: "admin", ids: [TRANSLATION_ID] });

		// Asking for a translation brings the source and every other member of the group, and nothing of other groups.
		expect(idsOf(plan.snapshot)).toEqual([POST_ID, TRANSLATION_ID, DRAFT_TRANSLATION_ID].sort());
		expect(plan.summary.entries).toBe(3);
		expect(plan.summary.addedByTranslations).toBe(2);
		expect(plan.selection).toEqual([TRANSLATION_ID]);
	});

	it("DATA-B4 a selection that is a whole group adds nothing, and repeated ids count once", () => {
		const plan = planExport(makeSnapshot(), {
			scope: "admin",
			ids: [POST_ID, TRANSLATION_ID, DRAFT_TRANSLATION_ID, POST_ID],
		});

		expect(plan.summary.addedByTranslations).toBe(0);
		expect(plan.selection).toEqual([POST_ID, TRANSLATION_ID, DRAFT_TRANSLATION_ID]);
	});

	it("DATA-B4 a selection holds only what its entries use, and no templates or preferences", () => {
		const plan = planExport(makeSnapshot(), { scope: "admin", ids: [POST_ID] });

		// The folder the post sits in, with its parent; not the folder of nobody.
		expect(plan.snapshot.folders.map((folder) => folder.id).sort()).toEqual([ROOT_FOLDER, CHILD_FOLDER].sort());
		// Addresses of the group's members only.
		expect(
			plan.snapshot.addresses.every((address) => address.entryId && idsOf(plan.snapshot).includes(address.entryId)),
		).toBe(true);
		expect(plan.snapshot.addresses.map((address) => address.slug).sort()).toEqual(["old-slug", "old-translated"]);
		// Media their bodies reference (working or published), by their references.
		expect(plan.snapshot.media.map((asset) => asset.id).sort()).toEqual([IMAGE_ID, OTHER_IMAGE_ID].sort());
		expect(plan.snapshot.references.every((reference) => idsOf(plan.snapshot).includes(reference.entryId))).toBe(true);
		expect(plan.snapshot.templates).toEqual([]);
		expect(plan.snapshot.preferences).toEqual([]);
		expect(plan.summary).toMatchObject({ templates: 0, folders: 2, addresses: 2, media: 2 });
	});

	it("DATA-B4 a selection of an entry that uses nothing holds no folders, addresses or media", () => {
		const plan = planExport(makeSnapshot(), { scope: "admin", ids: [ARCHIVED_ID] });

		expect(plan.summary).toMatchObject({ entries: 1, folders: 0, addresses: 0, media: 0, templates: 0 });
	});

	it("DATA-B4 ids that match no entry are counted, not hidden", () => {
		const plan = planExport(makeSnapshot(), {
			scope: "admin",
			ids: [DRAFT_ID, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
		});

		expect(plan.summary).toMatchObject({ entries: 1, notFound: 1 });
	});

	it("DATA-B3 a public selection holds the published members of the groups only, and says what it left out", () => {
		const plan = planExport(makeSnapshot(), { scope: "public", ids: [DRAFT_TRANSLATION_ID] });

		expect(idsOf(plan.snapshot)).toEqual([POST_ID, TRANSLATION_ID].sort());
		expect(plan.summary).toMatchObject({
			scope: "public",
			entries: 2,
			addedByTranslations: 2,
			notPublished: 1,
			templates: 0,
			folders: 0,
			addresses: 0,
		});
		// Only the media the published copies of those entries use.
		expect(plan.summary.media).toBe(2);
	});

	it("DATA-B3 a public selection of a draft holds nothing, and says why", () => {
		const plan = planExport(makeSnapshot(), { scope: "public", ids: [DRAFT_ID] });

		expect(plan.summary).toMatchObject({ entries: 0, notPublished: 1, media: 0 });
	});

	it("DATA-B3 the public export of the whole site counts the entries it leaves out", () => {
		const snapshot = makeSnapshot();
		const plan = planExport(snapshot, { scope: "public" });

		const published = snapshot.entries.filter((entry) => entry.status === "published").length;
		expect(plan.summary.entries).toBe(published);
		expect(plan.summary.notPublished).toBe(snapshot.entries.length - published);
	});
});

describe("an archive of a selection", () => {
	const build = (ids: string[] | undefined, scope: "admin" | "public" = "admin") => {
		const plan = planExport(makeSnapshot(), { scope, ids });
		return buildExportArchive(plan.snapshot, {
			site: testSite,
			scope,
			exportedAt: FIXTURE_TIME,
			selection: plan.selection,
		});
	};

	it("DATA-B4 records the selection in the manifest, and null for the whole site", () => {
		expect(build([POST_ID]).manifest.selection).toEqual({ ids: [POST_ID] });
		expect(build(undefined).manifest.selection).toBeNull();
		expect(build(undefined).manifest.notWritten).toEqual([]);
	});

	it("DATA-B4 holds the group's entries and the files its summary counted", () => {
		const plan = planExport(makeSnapshot(), { scope: "admin", ids: [TRANSLATION_ID] });
		const archive = build([TRANSLATION_ID]);
		const paths = readZipArchive(archive.zip).map((item) => item.path);

		expect(archive.manifest.entries.map((entry) => entry.id).sort()).toEqual(idsOf(plan.snapshot));
		for (const id of [POST_ID, TRANSLATION_ID, DRAFT_TRANSLATION_ID]) {
			expect(paths.some((path) => path.includes(id))).toBe(true);
		}
		expect(paths.some((path) => path.includes(DRAFT_ID))).toBe(false);
		expect(archive.manifest.counts).toMatchObject({
			entries: plan.summary.entries,
			folders: plan.summary.folders,
			addresses: plan.summary.addresses,
			media: plan.summary.media,
			templates: 0,
			preferences: 0,
		});
	});

	it("DATA-B4 a public selection agrees with its summary", () => {
		const plan = planExport(makeSnapshot(), { scope: "public", ids: [POST_ID] });
		const archive = build([POST_ID], "public");

		expect(archive.manifest.counts.entries).toBe(plan.summary.entries);
		expect(archive.manifest.counts.media).toBe(plan.summary.media);
	});
});
