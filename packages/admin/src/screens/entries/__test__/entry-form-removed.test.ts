import { emptyStoredDocument } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection, secondLocale } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import { type EntryData, formFromEntry, metadataFromForm } from "../entry-form";

const SOURCE = "11111111-1111-4111-8111-111111111111";

const entry = (fields: Partial<EntryData>): EntryData => ({
	id: SOURCE,
	collection: contentCollection,
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
 * must not coerce an option that is gone, so saving from the admin keeps both. Uses the site's first document collection with a body and its first
 * select field.
 */

/** The collection's first select field and one of its options other than the default, if it has one. */
const select = testSite.storedFields(contentCollection).flatMap(({ name, field, when }) => {
	if (field.kind !== "select" || when) return [];
	const options = Object.keys(field.options);
	return [{ name, option: options.find((option) => option !== field.defaultValue) ?? options[0] ?? "" }];
})[0];

describe("values of removed fields and options", () => {
	it.skipIf(!secondLocale)(
		"WRITE-S8 keeps it on an item collection with per-language names, and on a translation",
		() => {
			const locale = secondLocale ?? "";
			const record = { title: "에세이", translations: { [locale]: { title: "Essay" } }, removedField: "x" };
			const recordForm = formFromEntry(
				testSite,
				entry({ collection: recordCollection, working: { metadata: record, doc: emptyStoredDocument() } }),
			);
			expect(metadataFromForm(testSite, recordForm, recordCollection, record)).toEqual({ metadata: record });

			const translated = { title: "Hello", removedField: "x" };
			const translation = entry({
				id: "33333333-3333-4333-8333-333333333333",
				translationGroupId: SOURCE,
				locale,
				working: { metadata: translated, doc: emptyStoredDocument() },
			});
			expect(
				metadataFromForm(testSite, formFromEntry(testSite, translation), contentCollection, translated, {
					translation: true,
				}),
			).toEqual({
				metadata: translated,
			});
		},
	);

	it.skipIf(!select)(
		"WRITE-S8 shows a select value that is no longer an option as it is stored, and keeps it on save",
		() => {
			const name = select?.name ?? "";
			const metadata = { title: "T", [name]: "removed-option" };
			const form = formFromEntry(testSite, entry({ working: { metadata, doc: emptyStoredDocument() } }));
			expect(form[name]).toBe("removed-option");
			expect(metadataFromForm(testSite, form, contentCollection, metadata)).toEqual({ metadata });
		},
	);

	it.skipIf(!select)(
		"WRITE-S8 replaces it once the author picks an option, and does not accept a value it never stored",
		() => {
			const name = select?.name ?? "";
			const option = select?.option ?? "";
			const metadata = { title: "T", [name]: "removed-option" };
			const form = formFromEntry(testSite, entry({ working: { metadata, doc: emptyStoredDocument() } }));
			expect(metadataFromForm(testSite, { ...form, [name]: option }, contentCollection, metadata)).toEqual({
				metadata: { title: "T", [name]: option },
			});
			expect(metadataFromForm(testSite, { ...form, [name]: "typo" }, contentCollection, { title: "T" })).toEqual({
				metadata: { title: "T" },
			});
		},
	);
});
