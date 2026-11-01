import { describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { docOf } from "../../../../test/stored-content";
import type { ExportSnapshotBody, ExportSnapshotEntry, RestorePlan } from "../../../core/store/types";
import { entryLinkHref, linkMarkAttrs } from "../../../doc/entry-links";
import type { StoredDocument } from "../../../doc/stored-document";
import type { CmsNode } from "../../../doc/types";
import type { RestoreProblem } from "../types";
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
	grandchild: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	rootMedia: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
	untitled: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
	draftTag: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
	archived: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};

const body = (title: string, text: string, extra: Record<string, unknown> = {}): ExportSnapshotBody => ({
	metadata: { title, ...extra },
	doc: docOf(text),
	contentHash: `hash-${title}`,
	updatedAt: TIME,
});

/** `docOf` keeps an `entry:<id>` link as an address; a stored document holds it as the entry's id, as a text format reads it. */
const withEntryLinks = (doc: StoredDocument): StoredDocument => {
	const node = (item: CmsNode): CmsNode => ({
		...item,
		...(item.marks
			? {
					marks: item.marks.map((mark) =>
						mark.type === "link" && typeof mark.attrs?.href === "string"
							? { ...mark, attrs: linkMarkAttrs(mark.attrs.href) }
							: mark,
					),
				}
			: {}),
		...(item.content ? { content: item.content.map(node) } : {}),
	});
	return { ...doc, content: doc.content.map(node) };
};

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

/** A media record as a finished upload leaves it. */
const mediaFile = (id: string, folderId: string | null, filename: string): RestorePlan["media"][number] => ({
	id,
	folderId,
	status: "ready",
	filename,
	mimeType: "image/png",
	byteSize: 1234,
	width: 20,
	height: 10,
	stagingKey: null,
	storageKey: `media/${filename}`,
	createdAt: TIME,
	original: null,
	defaultAlt: "",
	defaultCaption: "",
	updatedAt: TIME,
	readyAt: TIME,
});

/**
 * A backup of the reference blog with one of each thing a restore checks: a tag and a draft tag, a published memo with its English translation, a memo in a
 * nested folder, an untitled draft, an archived memo whose published copy names the draft tag, media files in a media folder and at the top, the addresses
 * (one left by an entry deleted for good), references and a template. The published memo uses an image, links to itself by address and to a draft by id, and
 * keeps the value of a field the site has since removed (`retired`). It has no problem, so each case below breaks one thing.
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
		entry({ id: ids.draftTag, collection: "tag", workingSlug: "a-draft-tag", working: body("A draft tag", "") }),
		entry({
			id: ids.alpha,
			collection: "memo",
			status: "published",
			workingSlug: "alpha",
			publishedSlug: "alpha",
			publishedAt: TIME,
			working: body("Alpha", "Alpha, a newer draft", { tagIds: [ids.tag], retired: "kept" }),
			published: {
				...body("Alpha", "", { tagIds: [ids.tag], ogImageId: ids.media, retired: "kept" }),
				doc: withEntryLinks(
					docOf(`Alpha, published. [Itself](/memos/alpha) and [a draft](${entryLinkHref(ids.inFolder)}).`),
				),
			},
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
		entry({
			id: ids.untitled,
			collection: "memo",
			workingSlug: "untitled",
			working: { ...body("", "Not named yet"), metadata: {} },
		}),
		entry({
			id: ids.archived,
			collection: "memo",
			status: "archived",
			workingSlug: "archived",
			publishedSlug: "archived",
			publishedAt: TIME,
			working: body("Archived", "Archived body", { tagIds: [ids.draftTag] }),
			published: body("Archived", "Archived body", { tagIds: [ids.draftTag] }),
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
		{
			entryId: ids.alpha,
			state: "published",
			kind: "media",
			targetId: ids.media,
			isStale: false,
			occurrences: [{ type: "metadata", path: "ogImageId" }],
		},
	],
	folders: [
		{ id: ids.parent, collection: "memo", parentId: null, name: "Notes", position: 0, version: 1 },
		{ id: ids.child, collection: "memo", parentId: ids.parent, name: "Old", position: 0, version: 1 },
		{ id: ids.grandchild, collection: "memo", parentId: ids.child, name: "Older", position: 0, version: 1 },
		{ id: ids.mediaFolder, collection: "media", parentId: null, name: "Photos", position: 0, version: 1 },
	],
	addresses: [
		{ collection: "memo", locale: "ko", slug: "alpha", entryId: ids.alpha, type: "current" },
		{ collection: "memo", locale: "ko", slug: "gone", entryId: null, type: "deleted" },
	],
	media: [mediaFile(ids.media, ids.mediaFolder, "photo.png"), mediaFile(ids.rootMedia, null, "top.png")],
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
	/** What the problem must say: its code, and the params its text shows. */
	type Expected = Pick<RestoreProblem, "code"> & Partial<Pick<RestoreProblem, "params">>;
	const breaks: [string, Expected, (plan: Rows) => void][] = [
		[
			"an entry id that is not an id",
			{ code: "id_invalid" },
			(plan) => {
				find(plan.entries, ids.inFolder).id = "not-an-id";
			},
		],
		[
			"a folder twice",
			{ code: "id_repeated" },
			(plan) => {
				plan.folders.push({ ...plan.folders[0] });
			},
		],
		[
			"a template id twice",
			{ code: "id_repeated" },
			(plan) => {
				plan.templates.push({ ...plan.templates[0], name: "Another" });
			},
		],
		[
			"a folder whose parent is not there",
			{ code: "folder_missing" },
			(plan) => {
				find(plan.folders, ids.parent).parentId = otherId;
			},
		],
		[
			"folders that are each other's parent",
			{ code: "folder_cycle" },
			(plan) => {
				const child = find(plan.folders, ids.child);
				find(plan.folders, child.parentId as string).parentId = child.id;
			},
		],
		[
			"a media file in a folder that is not there",
			{ code: "folder_missing" },
			(plan) => {
				find(plan.media, ids.media).folderId = otherId;
			},
		],
		[
			"a media file in a folder of entries",
			{ code: "folder_other_collection" },
			(plan) => {
				find(plan.media, ids.media).folderId = ids.child;
			},
		],
		[
			"an address twice",
			{ code: "address_repeated" },
			(plan) => {
				plan.addresses.push({ ...plan.addresses[0] });
			},
		],
		[
			"an address of a collection the site does not have",
			{ code: "address_collection_unknown", params: { collection: "nowhere" } },
			(plan) => {
				plan.addresses.push({ ...plan.addresses[0], collection: "nowhere", slug: "x" });
			},
		],
		[
			"a reference to an entry that is not there",
			{ code: "reference_missing" },
			(plan) => {
				plan.references.push({
					...plan.references.find((reference) => reference.kind === "entry"),
					targetId: otherId,
				});
			},
		],
		[
			"a reference to a media file that is not there",
			{ code: "media_missing" },
			(plan) => {
				const reference = plan.references.find((item) => item.kind === "entry");
				plan.references.push({ ...reference, kind: "media", targetId: otherId });
			},
		],
		[
			"an entry of a collection the site does not have",
			{ code: "collection_unknown", params: { collection: "nowhere" } },
			(plan) => {
				find(plan.entries, ids.inFolder).collection = "nowhere";
			},
		],
		[
			"a translation twice in one language",
			{ code: "translation_repeated", params: { locale: "en" } },
			(plan) => {
				plan.entries.push({ ...find(plan.entries, ids.translation), id: otherId });
			},
		],
		[
			"a language the site does not have",
			{ code: "locale_unknown", params: { locale: "xx" } },
			(plan) => {
				find(plan.entries, ids.translation).locale = "xx";
			},
		],
		[
			"an entry in a folder of another collection",
			{ code: "folder_other_collection" },
			(plan) => {
				find(plan.entries, ids.inFolder).folderId = ids.mediaFolder;
			},
		],
		[
			"a translation whose source is a translation",
			{ code: "source_other_collection" },
			(plan) => {
				const translation = find(plan.entries, ids.translation);
				plan.entries.push({ ...translation, id: otherId, locale: "ko", translationGroupId: translation.id });
			},
		],
		[
			"a template id that is not an id",
			{ code: "id_invalid" },
			(plan) => {
				find(plan.templates, ids.template).id = "not-an-id";
			},
		],
		[
			"an entry in a folder that is not there",
			{ code: "folder_missing" },
			(plan) => {
				find(plan.entries, ids.inFolder).folderId = otherId;
			},
		],
		[
			"an address of an entry that is not there",
			{ code: "address_entry_missing" },
			(plan) => {
				plan.addresses.push({ ...plan.addresses[0], slug: "elsewhere", entryId: otherId });
			},
		],
		[
			"a draft with a field value the site does not take",
			{ code: "body_invalid", params: { state: "working" } },
			(plan) => {
				const entry = find(plan.entries, ids.inFolder);
				entry.working = { ...(entry.working as Row), metadata: { title: "x".repeat(201) } };
			},
		],
		[
			"a published body with a field value the site does not take",
			{ code: "body_invalid", params: { state: "published" } },
			(plan) => {
				const alpha = find(plan.entries, ids.alpha);
				alpha.published = { ...(alpha.published as Row), metadata: { title: "x".repeat(201) } };
			},
		],
		[
			"a published entry that names a draft tag",
			{ code: "publish_invalid" },
			(plan) => {
				const alpha = find(plan.entries, ids.alpha);
				const published = alpha.published as Row;
				alpha.published = { ...published, metadata: { ...(published.metadata as Row), tagIds: [ids.draftTag] } };
			},
		],
		[
			"a published post without the category the site requires",
			{ code: "publish_invalid" },
			(plan) => {
				const post = { ...find(plan.entries, ids.tag), id: otherId, translationGroupId: otherId, collection: "post" };
				plan.entries.push({ ...post, working: body("A post", "Post body"), published: body("A post", "Post body") });
			},
		],
		[
			"a published translation whose source is not published",
			{ code: "publish_invalid" },
			(plan) => {
				find(plan.entries, ids.alpha).status = "archived";
				const translation = find(plan.entries, ids.translation);
				Object.assign(translation, { status: "published", publishedSlug: "alpha", published: translation.working });
			},
		],
		[
			"a translation with a field of its source",
			{ code: "translation_invalid" },
			(plan) => {
				const translation = find(plan.entries, ids.translation);
				translation.working = body("Alpha in English", "English body", { tagIds: [ids.tag] });
			},
		],
		[
			"a translation whose published body has a field of its source",
			{ code: "translation_invalid" },
			(plan) => {
				const translation = find(plan.entries, ids.translation);
				Object.assign(translation, {
					status: "published",
					publishedSlug: "alpha",
					published: body("Alpha in English", "English body", { tagIds: [ids.tag] }),
				});
			},
		],
		[
			"a draft of an entry that is not a translation, with a translation state",
			{ code: "translation_invalid" },
			(plan) => {
				const alpha = find(plan.entries, ids.alpha);
				alpha.working = { ...(alpha.working as Row), translation: { version: 4, baseDoc: docOf("Source") } };
			},
		],
		[
			"a published body of an entry that is not a translation, with a translation state",
			{ code: "translation_invalid" },
			(plan) => {
				const alpha = find(plan.entries, ids.alpha);
				alpha.published = { ...(alpha.published as Row), translation: { version: 4, baseDoc: docOf("Source") } };
			},
		],
		[
			"a published body that links to an address the backup does not have",
			{ code: "publish_invalid" },
			(plan) => {
				const alpha = find(plan.entries, ids.alpha);
				alpha.published = { ...(alpha.published as Row), doc: docOf("[Nowhere](/memos/nowhere)") };
			},
		],
		[
			"a published entry with no published body",
			{ code: "published_body_missing" },
			(plan) => {
				find(plan.entries, ids.alpha).published = undefined;
			},
		],
	];

	it.each(breaks)("DATA-R3 %s", async (_, expected, breakIt) => {
		const plan = validPlan() as unknown as Rows;
		expect(await validateRestorePlan(testSite, plan as unknown as RestorePlan)).toEqual([]);
		breakIt(plan);
		const problems = await validateRestorePlan(testSite, plan as unknown as RestorePlan);
		expect(problems).toContainEqual(expect.objectContaining(expected));
	});
});
