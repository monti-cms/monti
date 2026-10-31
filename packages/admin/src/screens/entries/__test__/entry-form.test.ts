import { emptyStoredDocument, STORED_DOCUMENT_VERSION } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
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
const CATEGORY = "22222222-2222-4222-8222-222222222222";

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

describe("translation form", () => {
	it("TRANS-N3 a translation handles only per-language values as the form and metadata", () => {
		const translation = entry({
			id: "33333333-3333-4333-8333-333333333333",
			translationGroupId: SOURCE,
			locale: "en",
			publishedAt: "2026-01-01T00:00:00.000Z",
			working: { metadata: { title: "Hello", summary: "Sum" }, doc: docOf("Body") },
		});
		const form = formFromEntry(testSite, translation);
		// The form also handles the translation state (`$translation`); it must not leak into metadata.
		expect(
			metadataFromForm(
				testSite,
				{ ...form, categoryId: CATEGORY, publishedAt: "2026-01-01T09:00" },
				"post",
				{},
				{ translation: true },
			),
		).toEqual({ metadata: { title: "Hello", summary: "Sum" } });
	});

	it("TRANS-N3 the original also handles shared values", () => {
		const form = formFromEntry(
			testSite,
			entry({ working: { metadata: { title: "안녕", categoryId: CATEGORY }, doc: emptyStoredDocument() } }),
		);
		expect(form.categoryId).toBe(CATEGORY);
		expect(metadataFromForm(testSite, form, "post")).toEqual({ metadata: { title: "안녕", categoryId: CATEGORY } });
	});
});

describe("record per-language names", () => {
	it("TRANS-N3 reads other-language names as form keys and does not save emptied languages", () => {
		const form = formFromEntry(
			testSite,
			entry({
				collection: "category",
				working: {
					metadata: { title: "에세이", translations: { en: { title: "Essay" } } },
					doc: emptyStoredDocument(),
				},
			}),
		);
		expect(form[recordTranslationKey("title", "en")]).toBe("Essay");
		expect(form[recordTranslationKey("title", "ja")]).toBe("");
		expect(
			metadataFromForm(testSite, { ...form, [recordTranslationKey("title", "ja")]: " エッセイ " }, "category", {
				translations: { en: { title: "old" } },
			}),
		).toEqual({ metadata: { title: "에세이", translations: { en: { title: "Essay" }, ja: { title: "エッセイ" } } } });
		expect(
			metadataFromForm(testSite, { ...form, [recordTranslationKey("title", "en")]: "" }, "category", {
				translations: { en: { title: "Essay" } },
			}),
		).toEqual({ metadata: { title: "에세이" } });
	});
});

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

	it("a state with an invalid document is treated as unconfirmed", () => {
		const form = formFromEntry(testSite, translation({ version: 4, baseDoc: { type: "doc" } }));
		expect(translationPayload(form)).toEqual(EMPTY);
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
