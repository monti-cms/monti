import { describe, expect, it } from "vitest";
import { importConfig, paragraph, sourceEntry } from "../../../../test/entry-import-fixture";
import { doc, paragraphsFormat } from "../../../../test/paragraphs-format";
import { fakeCms } from "../../../cms";
import type { MediaStore } from "../../../media/store";
import { type ImportMapping, planImport } from "../plan";
import type { SourceEntry } from "../types";

const OUR_MEDIA = "11111111-1111-4111-8111-111111111111";
const FOREIGN_IMAGE = "22222222-2222-4222-8222-222222222222";
const FOREIGN_FILE = "33333333-3333-4333-8333-333333333333";

/**
 * A site whose store holds the slug `taken` (in notes, in German), the media file {@link OUR_MEDIA} and its public URL
 * `https://media.test/ours.png`. Nothing else is in it.
 */
const host = fakeCms({
	config: importConfig,
	formats: [paragraphsFormat],
	store: {
		slugsInUse: async ({ collection, locale, slugs }) =>
			new Set(slugs.filter((slug) => collection === "note" && locale === "de" && slug === "taken")),
		getMediaAsset: async (id) => (id === OUR_MEDIA ? ({ id } as never) : null),
		findReadyMediaByStorageKeys: async ({ keys }) =>
			keys.includes("ours.png") ? [{ id: OUR_MEDIA, storageKey: "ours.png" }] : [],
	},
	mediaStore: { getPublicUrl: (key: string) => `https://media.test/${key}` } as Partial<MediaStore>,
});

const plan = (entries: SourceEntry[], mapping?: ImportMapping) =>
	planImport(host, { kind: "export", entries, otherFiles: 0 }, mapping);

const byKey = async (entries: SourceEntry[], mapping?: ImportMapping) =>
	Object.fromEntries((await plan(entries, mapping)).entries.map((entry) => [entry.source.key, entry]));

describe("planImport", () => {
	it("DATA-I1 skips each entry it cannot import, with the reason, and still shows its title", async () => {
		const result = await plan(
			[
				sourceEntry("kept"),
				sourceEntry("unread", { problem: { code: "unreadable" }, slug: null, metadata: {}, body: null }),
				sourceEntry("broken", {
					isSource: false,
					problem: { code: "front_matter_invalid", params: { message: "not YAML", line: 2 } },
				}),
				sourceEntry("red", { collection: "label" }),
				sourceEntry("gone", { collection: "gone", metadata: { name: "Title of gone" } }),
				sourceEntry("old", { collection: "old" }),
				sourceEntry("unknown-language", { locale: "xx" }),
				sourceEntry("french-source", { locale: "fr" }),
				sourceEntry("untitled", { slug: null, metadata: {} }),
				sourceEntry("taken"),
				sourceEntry("twin-1", { slug: "twin" }),
				sourceEntry("twin-2", { slug: "twin" }),
				sourceEntry("bodiless", { body: null }),
				// Translations: of a source not in the archive, of a skipped source, and in a language the site lacks.
				sourceEntry("orphan", { isSource: false, group: "nowhere", locale: "fr" }),
				sourceEntry("taken-fr", { isSource: false, group: "taken", locale: "fr" }),
				sourceEntry("kept-xx", { isSource: false, group: "kept", locale: "xx" }),
			],
			{ old: null },
		);
		const told = Object.fromEntries(
			result.entries.map((entry) => [entry.source.key, { skip: entry.skip, title: entry.title, target: entry.target }]),
		);
		const titled = (key: string) => `Title of ${key}`;
		expect(told).toEqual({
			kept: { skip: null, title: titled("kept"), target: "note" },
			unread: { skip: { code: "unreadable" }, title: null, target: "note" },
			broken: {
				skip: { code: "front_matter_invalid", params: { message: "not YAML", line: 2 } },
				title: titled("broken"),
				target: "note",
			},
			red: { skip: { code: "item_collection", params: { collection: "label" } }, title: titled("red"), target: null },
			gone: { skip: { code: "no_collection", params: { collection: "gone" } }, title: titled("gone"), target: null },
			old: { skip: { code: "skipped_by_choice" }, title: titled("old"), target: null },
			"unknown-language": {
				skip: { code: "locale_unknown", params: { locale: "xx" } },
				title: titled("unknown-language"),
				target: "note",
			},
			"french-source": {
				skip: { code: "locale_not_default", params: { locale: "fr" } },
				title: titled("french-source"),
				target: "note",
			},
			untitled: { skip: { code: "no_title" }, title: null, target: "note" },
			taken: { skip: { code: "slug_exists", params: { slug: "taken" } }, title: titled("taken"), target: "note" },
			"twin-1": { skip: null, title: titled("twin-1"), target: "note" },
			"twin-2": { skip: { code: "slug_repeated", params: { slug: "twin" } }, title: titled("twin-2"), target: "note" },
			bodiless: { skip: { code: "no_body" }, title: titled("bodiless"), target: "note" },
			orphan: { skip: { code: "source_missing" }, title: titled("orphan"), target: null },
			"taken-fr": { skip: { code: "source_skipped" }, title: titled("taken-fr"), target: null },
			"kept-xx": {
				skip: { code: "locale_unknown", params: { locale: "xx" } },
				title: titled("kept-xx"),
				target: "note",
			},
		});
		// The collections, with how many entries each holds and where they go.
		expect(Object.fromEntries(result.collections.map(({ name, ...rest }) => [name, rest]))).toEqual({
			note: { entries: 13, target: "note", skipped: null },
			label: { entries: 1, target: null, skipped: { code: "item_collection", params: { collection: "label" } } },
			gone: { entries: 1, target: null, skipped: { code: "no_collection", params: { collection: "gone" } } },
			old: { entries: 1, target: null, skipped: { code: "skipped_by_choice" } },
		});
	});

	it("DATA-I1 skips an entry whose address the write would refuse, says why, and checks the address as it would be stored", async () => {
		const entries = await byKey([
			sourceEntry("question", { slug: "what?" }),
			sourceEntry("path", { slug: "a/b" }),
			sourceEntry("long", { slug: "x".repeat(201) }),
			sourceEntry("padded", { slug: " taken " }),
		]);
		expect(entries.question?.skip).toEqual({ code: "slug_invalid", params: { slug: "what?" } });
		expect(entries.path?.skip).toEqual({ code: "slug_invalid", params: { slug: "a/b" } });
		expect(entries.long?.skip).toEqual({ code: "slug_too_long", params: { max: 200 } });
		// Stored trimmed, so it is the address another entry already has.
		expect(entries.padded?.skip).toEqual({ code: "slug_exists", params: { slug: "taken" } });
	});

	it("DATA-I17 reads the title under the target's title field, then under title or name, and else takes the slug and says so", async () => {
		const entries = await byKey(
			[
				sourceEntry("plain"),
				sourceEntry("named", { metadata: { name: "By name" } }),
				sourceEntry("slug-only", { metadata: {} }),
				sourceEntry("empty-title", { metadata: { title: "" } }),
				// Entries without a slug are imported, each of them.
				sourceEntry("no-slug-1", { slug: null }),
				sourceEntry("no-slug-2", { slug: null }),
				// Books keep their title in `headline`; the archive's papers have it in `title`.
				sourceEntry("paper", { collection: "paper" }),
			],
			{ paper: "book" },
		);
		const told = (key: string) => {
			const entry = entries[key];
			return { title: entry?.title, slug: entry?.slug, skip: entry?.skip, notes: entry?.notes };
		};
		expect(told("plain")).toEqual({ title: "Title of plain", slug: "plain", skip: null, notes: [] });
		expect(told("named")).toEqual({ title: "By name", slug: "named", skip: null, notes: [] });
		expect(told("slug-only")).toEqual({
			title: "slug-only",
			slug: "slug-only",
			skip: null,
			notes: [{ code: "title_from_slug" }],
		});
		expect(told("empty-title")).toEqual({
			title: "empty-title",
			slug: "empty-title",
			skip: null,
			notes: [{ code: "title_from_slug" }],
		});
		expect(told("no-slug-1")).toEqual({ title: "Title of no-slug-1", slug: null, skip: null, notes: [] });
		expect(told("no-slug-2")).toEqual({ title: "Title of no-slug-2", slug: null, skip: null, notes: [] });
		expect(told("paper")).toEqual({ title: "Title of paper", slug: "paper", skip: null, notes: [] });
		expect(entries.paper?.target).toBe("book");
	});

	it("DATA-I7 leaves out every image and file of another site's library, wherever it is, and counts only what points outside this site", async () => {
		const entries = await byKey([
			sourceEntry("nested", {
				body: {
					kind: "doc",
					doc: doc({ type: "blockquote", content: [{ type: "image", attrs: { mediaId: FOREIGN_IMAGE, alt: "" } }] }),
				},
			}),
			sourceEntry("attachment", {
				body: {
					kind: "doc",
					doc: doc({ type: "file", attrs: { mediaId: FOREIGN_FILE, label: "report.pdf" } }, paragraph("After")),
				},
			}),
			sourceEntry("ours", {
				body: {
					kind: "doc",
					doc: doc(
						{ type: "image", attrs: { mediaId: OUR_MEDIA, alt: "" } },
						{ type: "image", attrs: { src: "https://media.test/ours.png", alt: "" } },
						{ type: "image", attrs: { src: "https://elsewhere.test/pic.png", alt: "" } },
					),
				},
			}),
		]);
		const leftOut = { code: "images_left_out", params: { count: 1 } };
		expect(entries.nested).toMatchObject({ notes: [leftOut], outsideImages: 1 });
		expect(entries.nested?.doc?.content).toEqual([{ type: "blockquote", content: [] }]);
		expect(entries.attachment).toMatchObject({ notes: [leftOut], outsideImages: 1 });
		expect(entries.attachment?.doc?.content).toEqual([paragraph("After")]);
		// This site's media file stays, by id or by its URL; only the picture elsewhere is counted.
		expect(entries.ours).toMatchObject({ notes: [], outsideImages: 1 });
		expect(entries.ours?.doc?.content).toHaveLength(3);
	});

	it("DATA-I4 counts the links by id that point to an entry that is not imported, and only those", async () => {
		const ids = {
			first: "44444444-4444-4444-8444-444444444444",
			second: "55555555-5555-4555-8555-555555555555",
			elsewhere: "66666666-6666-4666-8666-666666666666",
		};
		const linkTo = (id: string) => ({
			type: "text",
			text: "a link",
			marks: [{ type: "link", attrs: { entryId: id } }],
		});
		const linking = (key: keyof typeof ids, ...targets: string[]) =>
			sourceEntry(ids[key], {
				group: ids[key],
				slug: key,
				body: { kind: "doc", doc: doc({ type: "paragraph", content: targets.map(linkTo) }) },
			});
		const entries = await byKey([linking("first", ids.second, ids.elsewhere), linking("second", ids.first)]);
		expect(entries[ids.first]).toMatchObject({
			keptLinks: 1,
			notes: [{ code: "links_kept", params: { count: 1 } }],
		});
		expect(entries[ids.second]).toMatchObject({ keptLinks: 0, notes: [] });
	});

	it("DATA-I4 says a text could not be read only when it could not", async () => {
		const text = (body: string) => ({ kind: "text" as const, format: "paragraphs", text: body });
		const entries = await byKey([
			sourceEntry("readable", { body: text("Plain words") }),
			sourceEntry("unreadable", { body: text("this has <<< in it") }),
			sourceEntry("stored"),
		]);
		expect(entries.readable).toMatchObject({ notes: [], readIssues: [] });
		expect(entries.unreadable?.notes).toEqual([{ code: "body_unparsed", params: { format: "paragraphs" } }]);
		expect(entries.unreadable?.readIssues.map((issue) => issue.code)).toEqual(["bad_marker"]);
		expect(entries.stored).toMatchObject({ notes: [], readIssues: [] });
	});

	it("DATA-I1 lists per collection the values that are not imported, and the required ones the import leaves empty", async () => {
		const result = await plan(
			[
				sourceEntry("full", {
					metadata: {
						title: "Full",
						kept: "a value",
						list: ["a"],
						zero: 0,
						off: false,
						empty: "",
						nothing: null,
						none: [],
					},
				}),
				// A skipped entry's values are not listed.
				sourceEntry("skipped", { body: null, metadata: { title: "Skipped", onlyHere: "x" } }),
				sourceEntry("paper", { collection: "paper", metadata: { title: "Paper", pages: 3 } }),
				sourceEntry("bare", { collection: "bare", metadata: { title: "Bare" } }),
			],
			{ paper: "book", bare: "note" },
		);
		const listed = Object.fromEntries(
			result.fieldsNotImported.map(({ collection, ...rest }) => [
				collection,
				{ ...rest, fields: [...rest.fields].sort() },
			]),
		);
		expect(listed).toEqual({
			note: { target: "note", fields: ["kept", "list", "off", "zero"], required: [] },
			paper: { target: "book", fields: ["pages"], required: ["isbn"] },
		});
	});
});
