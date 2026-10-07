import { emptyStoredDocument } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { type EntryData, formFromEntry, metadataFromForm } from "../entry-form";

const SOURCE = "11111111-1111-4111-8111-111111111111";

const entry = (fields: Partial<EntryData>): EntryData => ({
	id: SOURCE,
	collection: "post",
	status: "draft",
	version: 1,
	folderId: null,
	workingSlug: "hello",
	publishedSlug: null,
	working: { metadata: {}, doc: emptyStoredDocument() },
	...fields,
});

/**
 * A site removes a field or a select option while entries still hold its value. The form has no input for the value of a removed field and
 * must not coerce an option that is gone, so saving from the admin keeps both. Uses the reference blog's post (its `policy` select).
 */
describe("values of removed fields and options", () => {
	const stored = { title: "안녕", removedField: "left behind", removedList: ["a", "b"] };

	it("sends the value of a removed field back as stored; it is not a form field", () => {
		const form = formFromEntry(testSite, entry({ working: { metadata: stored, doc: emptyStoredDocument() } }));
		expect(Object.keys(form)).not.toContain("removedField");
		expect(metadataFromForm(testSite, form, "post", stored)).toEqual({ metadata: stored });
		// Editing another value does not touch it.
		expect(metadataFromForm(testSite, { ...form, title: "Renamed" }, "post", stored)).toEqual({
			metadata: { ...stored, title: "Renamed" },
		});
	});

	it("keeps it on an item collection with per-language names, and on a translation", () => {
		const record = { title: "에세이", translations: { en: { title: "Essay" } }, removedField: "x" };
		const recordForm = formFromEntry(
			testSite,
			entry({ collection: "category", working: { metadata: record, doc: emptyStoredDocument() } }),
		);
		expect(metadataFromForm(testSite, recordForm, "category", record)).toEqual({ metadata: record });

		const translated = { title: "Hello", removedField: "x" };
		const translation = entry({
			id: "33333333-3333-4333-8333-333333333333",
			translationGroupId: SOURCE,
			locale: "en",
			working: { metadata: translated, doc: emptyStoredDocument() },
		});
		expect(
			metadataFromForm(testSite, formFromEntry(testSite, translation), "post", translated, { translation: true }),
		).toEqual({
			metadata: translated,
		});
	});

	it("adds nothing for a key the entry never had", () => {
		const form = formFromEntry(testSite, entry({ working: { metadata: { title: "T" }, doc: emptyStoredDocument() } }));
		expect(metadataFromForm(testSite, form, "post", { title: "T" })).toEqual({ metadata: { title: "T" } });
	});

	it("shows a select value that is no longer an option as it is stored, and keeps it on save", () => {
		const metadata = { title: "T", policy: "removed-option" };
		const form = formFromEntry(testSite, entry({ working: { metadata, doc: emptyStoredDocument() } }));
		expect(form.policy).toBe("removed-option");
		expect(metadataFromForm(testSite, form, "post", metadata)).toEqual({ metadata });
	});

	it("replaces it once the author picks an option, and does not accept a value it never stored", () => {
		const metadata = { title: "T", policy: "removed-option" };
		const form = formFromEntry(testSite, entry({ working: { metadata, doc: emptyStoredDocument() } }));
		expect(metadataFromForm(testSite, { ...form, policy: "evergreen" }, "post", metadata)).toEqual({
			metadata: { title: "T", policy: "evergreen" },
		});
		expect(metadataFromForm(testSite, { ...form, policy: "typo" }, "post", { title: "T" })).toEqual({
			metadata: { title: "T" },
		});
	});
});
