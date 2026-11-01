import { emptyStoredDocument, STORED_DOCUMENT_VERSION } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { contentCollection, defaultLocale, recordCollection, titleFieldOf } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import { docOf } from "../../../test/mdx";
import {
	type EntryData,
	formFromEntry,
	metadataFromForm,
	recordTranslationKey,
	stringifyTranslation,
	TRANSLATION_FORM_KEY,
	translationPayload,
	translationStateFromForm,
} from "../entry-form";

const SOURCE = "11111111-1111-4111-8111-111111111111";
const RELATED = "22222222-2222-4222-8222-222222222222";

/** The locales other than the default: a translation is written in one of them. */
const otherLocales = testSite.LOCALES.filter((code) => code !== defaultLocale);
/** A text field besides the title that each language writes for itself (`localized`), if the collection has one. */
const perLanguage = testSite
	.storedFields(contentCollection)
	.find(({ name, field, when }) => name !== "title" && field.kind === "text" && field.localized === true && !when);
/** A relation the languages share (not `localized`), if the collection has one. */
const shared = testSite
	.storedFields(contentCollection)
	.find(({ field, when }) => field.kind === "relation" && !field.localized && !when);

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

describe("translation form", () => {
	it.skipIf(!otherLocales[0] || !perLanguage || !shared)(
		"TRANS-N3 a translation handles only per-language values as the form and metadata",
		() => {
			const own = { title: "Hello", [perLanguage?.name ?? ""]: "Sum" };
			const translation = entry({
				id: "33333333-3333-4333-8333-333333333333",
				translationGroupId: SOURCE,
				locale: otherLocales[0],
				publishedAt: "2026-01-01T00:00:00.000Z",
				working: { metadata: own, doc: docOf("Body") },
			});
			const form = formFromEntry(testSite, translation);
			// The form also handles the translation state (`$translation`); it must not leak into metadata.
			expect(
				metadataFromForm(
					testSite,
					{ ...form, [shared?.name ?? ""]: RELATED, publishedAt: "2026-01-01T09:00" },
					contentCollection,
					{},
					{ translation: true },
				),
			).toEqual({ metadata: own });
		},
	);

	it.skipIf(!shared)("TRANS-N3 the original also handles shared values", () => {
		const name = shared?.name ?? "";
		const value = shared?.field.kind === "relation" && shared.field.many ? [RELATED] : RELATED;
		const form = formFromEntry(
			testSite,
			entry({ working: { metadata: { title: "안녕", [name]: value }, doc: emptyStoredDocument() } }),
		);
		expect(form[name]).toEqual(value);
		expect(metadataFromForm(testSite, form, contentCollection)).toEqual({ metadata: { title: "안녕", [name]: value } });
	});
});

// Two languages besides the default: one that already has a name, and one that gets its first.
const [named, unnamed] = otherLocales as [string, string];

describe.skipIf(otherLocales.length < 2 || !titleFieldOf(recordCollection).localized)(
	"record per-language names",
	() => {
		it("TRANS-N3 reads other-language names as form keys and does not save emptied languages", () => {
			const form = formFromEntry(
				testSite,
				entry({
					collection: recordCollection,
					working: {
						metadata: { title: "에세이", translations: { [named]: { title: "Essay" } } },
						doc: emptyStoredDocument(),
					},
				}),
			);
			expect(form[recordTranslationKey("title", named)]).toBe("Essay");
			expect(form[recordTranslationKey("title", unnamed)]).toBe("");
			expect(
				metadataFromForm(
					testSite,
					{ ...form, [recordTranslationKey("title", unnamed)]: " エッセイ " },
					recordCollection,
					{ translations: { [named]: { title: "old" } } },
				),
			).toEqual({
				metadata: { title: "에세이", translations: { [named]: { title: "Essay" }, [unnamed]: { title: "エッセイ" } } },
			});
			expect(
				metadataFromForm(testSite, { ...form, [recordTranslationKey("title", named)]: "" }, recordCollection, {
					translations: { [named]: { title: "Essay" } },
				}),
			).toEqual({ metadata: { title: "에세이" } });
		});
	},
);

describe("translation state form", () => {
	const translation = (state: unknown) =>
		entry({
			id: "33333333-3333-4333-8333-333333333333",
			translationGroupId: SOURCE,
			locale: "en",
			working: { metadata: { title: "Hello" }, doc: docOf("Body"), translation: state as never },
		});

	const DOC = {
		version: STORED_DOCUMENT_VERSION,
		type: "doc",
		content: [{ type: "paragraph", id: "aaaaaaaa", content: [{ type: "text", text: "원문" }] }],
	} as const;
	const EMPTY = { version: 4, baseDoc: { type: "doc", version: STORED_DOCUMENT_VERSION, content: [] } };

	it("TRANS-N9 a translation form holds the confirmed source as JSON with fixed key order and sends it in the save request", () => {
		// The server (JSONB) returns keys reordered.
		const form = formFromEntry(testSite, translation({ baseDoc: DOC, version: 4 }));
		expect(form[TRANSLATION_FORM_KEY]).toBe(stringifyTranslation({ version: 4, baseDoc: DOC } as never));
		expect(translationPayload(form)).toEqual({ version: 4, baseDoc: DOC });
	});

	it("TRANS-N9 the confirmed document keeps one key order however the server ordered it", () => {
		const reordered = {
			type: "doc",
			content: [{ content: [{ text: "원문", type: "text" }], id: "aaaaaaaa", type: "paragraph" }],
			version: STORED_DOCUMENT_VERSION,
		};
		const first = formFromEntry(testSite, translation({ version: 4, baseDoc: DOC }));
		const second = formFromEntry(testSite, translation({ baseDoc: reordered, version: 4 }));
		expect(first[TRANSLATION_FORM_KEY]).toBe(second[TRANSLATION_FORM_KEY]);
		expect(translationPayload(first)).toEqual({ version: 4, baseDoc: DOC });
	});

	it("TRANS-N9 with no valid state, nothing is treated as confirmed", () => {
		for (const state of [null, undefined, { version: 1, units: [] }, { version: 2 }]) {
			expect(translationPayload(formFromEntry(testSite, translation(state)))).toEqual(EMPTY);
		}
		expect(translationStateFromForm("깨진 값")).toEqual(EMPTY);
		expect(translationStateFromForm(undefined)).toEqual(EMPTY);
	});

	it("TRANS-N9 the original does not send translation state", () => {
		expect(translationPayload(formFromEntry(testSite, entry({ translationGroupId: SOURCE })))).toBeUndefined();
	});
});
