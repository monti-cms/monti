import { describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { docOf } from "../../../../test/stored-content";
import type { ExportSnapshotBody, ExportSnapshotEntry, RestorePlan } from "../../../core/store/types";
import { validateRestorePlan } from "../validate";

const TIME = new Date("2026-09-22T00:00:00.000Z");
const ids = {
	tag: "11111111-1111-4111-8111-111111111111",
	alpha: "22222222-2222-4222-8222-222222222222",
	translation: "33333333-3333-4333-8333-333333333333",
	inFolder: "44444444-4444-4444-8444-444444444444",
	parent: "55555555-5555-4555-8555-555555555555",
	child: "66666666-6666-4666-8666-666666666666",
	mediaFolder: "77777777-7777-4777-8777-777777777777",
	media: "88888888-8888-4888-8888-888888888888",
	template: "99999999-9999-4999-8999-999999999999",
};

const body = (title: string, text: string, extra: Record<string, unknown> = {}): ExportSnapshotBody => ({
	metadata: { title, ...extra },
	doc: docOf(text),
	contentHash: `hash-${title}`,
	updatedAt: TIME,
});

const entry = (
	fields: Pick<ExportSnapshotEntry, "id" | "collection" | "working"> & Partial<ExportSnapshotEntry>,
): ExportSnapshotEntry => ({
	locale: "ko",
	translationGroupId: fields.id,
	status: "draft",
	version: 1,
	folderId: null,
	workingSlug: null,
	publishedSlug: null,
	createdAt: TIME,
	updatedAt: TIME,
	publishedAt: null,
	deletedAt: null,
	changedBy: null,
	changedAt: null,
	...fields,
});

/**
 * A backup of the reference blog with one of each thing a restore checks: a tag, a published memo with its English translation, a memo in a nested folder,
 * a media file in a media folder, an address, a reference and a template. It has no problem, so each case below breaks one thing.
 */
const validPlan = (): RestorePlan => ({
	entries: [
		entry({
			id: ids.tag,
			collection: "tag",
			status: "published",
			workingSlug: "a-tag",
			publishedSlug: "a-tag",
			publishedAt: TIME,
			working: body("A tag", ""),
			published: body("A tag", ""),
		}),
		entry({
			id: ids.alpha,
			collection: "memo",
			status: "published",
			workingSlug: "alpha",
			publishedSlug: "alpha",
			publishedAt: TIME,
			working: body("Alpha", "Alpha, a newer draft", { tagIds: [ids.tag] }),
			published: body("Alpha", "Alpha, published", { tagIds: [ids.tag] }),
		}),
		entry({
			id: ids.translation,
			collection: "memo",
			locale: "en",
			translationGroupId: ids.alpha,
			workingSlug: "alpha",
			working: body("Alpha in English", "English body"),
		}),
		entry({
			id: ids.inFolder,
			collection: "memo",
			folderId: ids.child,
			workingSlug: "in-folder",
			working: body("In a folder", "Body of In a folder"),
		}),
	],
	references: [
		{
			entryId: ids.alpha,
			state: "working",
			kind: "entry",
			targetId: ids.tag,
			isStale: false,
			occurrences: [{ type: "metadata", path: "tagIds", ordinal: 0 }],
		},
	],
	folders: [
		{ id: ids.parent, collection: "memo", parentId: null, name: "Notes", position: 0, version: 1 },
		{ id: ids.child, collection: "memo", parentId: ids.parent, name: "Old", position: 0, version: 1 },
		{ id: ids.mediaFolder, collection: "media", parentId: null, name: "Photos", position: 0, version: 1 },
	],
	addresses: [{ collection: "memo", locale: "ko", slug: "alpha", entryId: ids.alpha, type: "current" }],
	media: [
		{
			id: ids.media,
			folderId: ids.mediaFolder,
			status: "ready",
			filename: "photo.png",
			mimeType: "image/png",
			byteSize: 1234,
			width: 20,
			height: 10,
			stagingKey: null,
			storageKey: "media/photo.png",
			createdAt: TIME,
			original: null,
			defaultAlt: "",
			defaultCaption: "",
			updatedAt: TIME,
			readyAt: TIME,
		},
	],
	templates: [
		{ id: ids.template, name: "Custom template", doc: docOf(""), version: 1, createdAt: TIME, updatedAt: TIME },
	],
});

describe("DATA-R3 names each problem a backup can have", () => {
	type Row = Record<string, unknown>;
	/** The backup's plan as plain rows, to break one thing at a time. */
	type Rows = Record<"entries" | "folders" | "media" | "addresses" | "references" | "templates", Row[]>;
	const otherId = "123e4567-e89b-42d3-a456-426614174999";
	const find = (rows: Row[], id: string | undefined) => rows.find((row) => row.id === id) as Row;
	const breaks: [string, string, (plan: Rows) => void][] = [
		[
			"an entry id that is not an id",
			"id_invalid",
			(plan) => {
				find(plan.entries, ids.inFolder).id = "not-an-id";
			},
		],
		[
			"a folder twice",
			"id_repeated",
			(plan) => {
				plan.folders.push({ ...plan.folders[0] });
			},
		],
		[
			"a template id twice",
			"id_repeated",
			(plan) => {
				plan.templates.push({ ...plan.templates[0], name: "Another" });
			},
		],
		[
			"a folder whose parent is not there",
			"folder_missing",
			(plan) => {
				find(plan.folders, ids.child).parentId = otherId;
			},
		],
		[
			"folders that are each other's parent",
			"folder_cycle",
			(plan) => {
				const child = find(plan.folders, ids.child);
				find(plan.folders, child.parentId as string).parentId = child.id;
			},
		],
		[
			"a media file in a folder that is not there",
			"folder_missing",
			(plan) => {
				find(plan.media, ids.media).folderId = otherId;
			},
		],
		[
			"a media file in a folder of entries",
			"folder_other_collection",
			(plan) => {
				find(plan.media, ids.media).folderId = ids.child;
			},
		],
		[
			"an address twice",
			"address_repeated",
			(plan) => {
				plan.addresses.push({ ...plan.addresses[0] });
			},
		],
		[
			"an address of a collection the site does not have",
			"address_collection_unknown",
			(plan) => {
				plan.addresses.push({ ...plan.addresses[0], collection: "nowhere", slug: "x" });
			},
		],
		[
			"a reference to an entry that is not there",
			"reference_missing",
			(plan) => {
				plan.references.push({
					...plan.references.find((reference) => reference.kind === "entry"),
					targetId: otherId,
				});
			},
		],
		[
			"a reference to a media file that is not there",
			"media_missing",
			(plan) => {
				const reference = plan.references.find((item) => item.kind === "entry");
				plan.references.push({ ...reference, kind: "media", targetId: otherId });
			},
		],
		[
			"an entry of a collection the site does not have",
			"collection_unknown",
			(plan) => {
				find(plan.entries, ids.inFolder).collection = "nowhere";
			},
		],
		[
			"a translation twice in one language",
			"translation_repeated",
			(plan) => {
				plan.entries.push({ ...find(plan.entries, ids.translation), id: otherId });
			},
		],
		[
			"a language the site does not have",
			"locale_unknown",
			(plan) => {
				find(plan.entries, ids.translation).locale = "xx";
			},
		],
		[
			"an entry in a folder of another collection",
			"folder_other_collection",
			(plan) => {
				find(plan.entries, ids.inFolder).folderId = ids.mediaFolder;
			},
		],
		[
			"a translation whose source is a translation",
			"source_other_collection",
			(plan) => {
				const translation = find(plan.entries, ids.translation);
				plan.entries.push({ ...translation, id: otherId, locale: "ko", translationGroupId: translation.id });
			},
		],
		[
			"a published entry with no published body",
			"published_body_missing",
			(plan) => {
				find(plan.entries, ids.alpha).published = undefined;
			},
		],
	];

	it.each(breaks)("DATA-R3 %s", async (_, code, breakIt) => {
		const plan = validPlan() as unknown as Rows;
		expect(await validateRestorePlan(testSite, plan as unknown as RestorePlan)).toEqual([]);
		breakIt(plan);
		const problems = await validateRestorePlan(testSite, plan as unknown as RestorePlan);
		expect(problems.map((problem) => problem.code)).toContain(code);
	});
});
