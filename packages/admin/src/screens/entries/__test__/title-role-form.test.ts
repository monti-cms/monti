import { defineCollection, defineSite, fields } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/client";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { columnsFor } from "../../list-columns";
import {
	copyTitle,
	type EntryData,
	formFromEntry,
	formTitle,
	metadataFromForm,
	titleKeyOf,
	titlePatch,
	translationSourceOf,
} from "../entry-form";

/** A site whose title lives in `headline` (role `title`) in a document collection and in `name` in an item collection. */
const site = createSite(
	defineSite({
		collections: {
			article: defineCollection({
				label: "Article",
				kind: "document",
				path: "/articles/:slug",
				fields: {
					headline: fields.text({ label: "Headline", role: "title", required: true, max: 20, localized: true }),
					slug: fields.slug({ label: "Slug", from: "headline" }),
					note: fields.text({ label: "Note" }),
				},
				list: { columns: ["headline", "note", "status"] },
			}),
			topic: defineCollection({
				label: "Topic",
				kind: "item",
				fields: {
					name: fields.text({ label: "Name", role: "title", required: true, localized: true }),
					slug: fields.slug({ label: "Slug", from: "name" }),
				},
			}),
		},
		locales: [
			{ code: "en", name: "English" },
			{ code: "ko", name: "한국어" },
		],
		defaultLocale: "en",
	}),
);

const article = (metadata: Record<string, unknown>, extra: Partial<EntryData> = {}): EntryData => ({
	id: "11111111-1111-4111-8111-111111111111",
	collection: "article",
	status: "draft",
	version: 1,
	folderId: null,
	workingSlug: "hello",
	publishedSlug: null,
	working: { metadata, doc: emptyStoredDocument() },
	...extra,
});

describe("the title in the edit form", () => {
	it("is kept under the name of the title field, and written back to that key", () => {
		expect(titleKeyOf(site, "article")).toBe("headline");
		expect(titleKeyOf(site, "topic")).toBe("name");
		const form = formFromEntry(site, article({ headline: "Hello", note: "n" }));
		expect(form).toMatchObject({ headline: "Hello", note: "n", slug: "hello" });
		expect(form).not.toHaveProperty("title");
		expect(formTitle(site, "article", form)).toBe("Hello");

		const edited = { ...form, ...titlePatch(site, "article", "Hello again") };
		const built = metadataFromForm(site, edited, "article", { headline: "Hello", note: "n" });
		expect(built).toEqual({ metadata: { headline: "Hello again", note: "n" } });
	});

	it("is the title of a translation's source", () => {
		const translation = article(
			{ headline: "Translated" },
			{
				id: "33333333-3333-4333-8333-333333333333",
				translationGroupId: "11111111-1111-4111-8111-111111111111",
				locale: "ko",
				source: {
					id: "11111111-1111-4111-8111-111111111111",
					locale: "en",
					status: "draft",
					workingSlug: "hello",
					metadata: { headline: "Source headline" },
					doc: emptyStoredDocument(),
				},
			},
		);
		expect(translationSourceOf(site, translation)?.title).toBe("Source headline");
	});

	it("is shortened to the length the title field allows when a copy gets a suffix", () => {
		expect(copyTitle(site, "article", "A very long headline indeed")).toHaveLength(20);
		expect(copyTitle(site, "article", "Short")).toContain("Short");
	});

	it("is one list column, `title`, whatever the title field is named", () => {
		const { available, defaults } = columnsFor(site, "article");
		expect(available.filter((column) => column === "title" || column === "headline")).toEqual(["title"]);
		expect(defaults).toEqual(["title", "note", "status"]);
	});
});
