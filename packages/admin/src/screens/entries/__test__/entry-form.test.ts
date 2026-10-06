import { STORED_DOCUMENT_VERSION } from "@monti-cms/core/mdx";
import { describe, expect, it } from "vitest";
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
	working: { metadata: {}, mdx: "" },
	...fields,
});

describe("translation form", () => {
	it("a translation handles only per-language values as the form and metadata", () => {
		const translation = entry({
			id: "33333333-3333-4333-8333-333333333333",
			translationGroupId: SOURCE,
			locale: "en",
			publishedAt: "2026-01-01T00:00:00.000Z",
			working: { metadata: { title: "Hello", summary: "Sum" }, mdx: "Body" },
		});
		const form = formFromEntry(translation);
		// The form also handles the translation state (`$translation`); it must not leak into metadata.
		expect(
			metadataFromForm(
				{ ...form, categoryId: CATEGORY, publishedAt: "2026-01-01T09:00" },
				"post",
				{},
				{ translation: true },
			),
		).toEqual({ metadata: { title: "Hello", summary: "Sum" } });
	});

	it("the original also handles shared values", () => {
		const form = formFromEntry(entry({ working: { metadata: { title: "안녕", categoryId: CATEGORY }, mdx: "" } }));
		expect(form.categoryId).toBe(CATEGORY);
		expect(metadataFromForm(form, "post")).toEqual({ metadata: { title: "안녕", categoryId: CATEGORY } });
	});
});

describe("record per-language names", () => {
	it("reads other-language names as form keys and does not save emptied languages", () => {
		const form = formFromEntry(
			entry({
				collection: "category",
				working: { metadata: { title: "에세이", translations: { en: { title: "Essay" } } }, mdx: "" },
			}),
		);
		expect(form[recordTranslationKey("title", "en")]).toBe("Essay");
		expect(form[recordTranslationKey("title", "ja")]).toBe("");
		expect(
			metadataFromForm({ ...form, [recordTranslationKey("title", "ja")]: " エッセイ " }, "category", {
				translations: { en: { title: "old" } },
			}),
		).toEqual({ metadata: { title: "에세이", translations: { en: { title: "Essay" }, ja: { title: "エッセイ" } } } });
		expect(
			metadataFromForm({ ...form, [recordTranslationKey("title", "en")]: "" }, "category", {
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
			working: { metadata: { title: "Hello" }, mdx: "Body", translation: state as never },
		});

	const DOC = {
		version: STORED_DOCUMENT_VERSION,
		type: "doc",
		content: [{ type: "paragraph", id: "aaaaaaaa", content: [{ type: "text", text: "원문" }] }],
	} as const;
	const EMPTY = { version: 4, baseDoc: { type: "doc", version: STORED_DOCUMENT_VERSION, content: [] } };

	it("a translation form holds the confirmed source as JSON with fixed key order and sends it in the save request", () => {
		// The server (JSONB) returns keys reordered.
		const form = formFromEntry(translation({ baseDoc: DOC, version: 4 }));
		expect(form[TRANSLATION_FORM_KEY]).toBe(stringifyTranslation({ version: 4, baseDoc: DOC } as never));
		expect(translationPayload(form)).toEqual({ version: 4, baseDoc: DOC });
	});

	it("the confirmed document keeps one key order however the server ordered it", () => {
		const reordered = {
			type: "doc",
			content: [{ content: [{ text: "원문", type: "text" }], id: "aaaaaaaa", type: "paragraph" }],
			version: STORED_DOCUMENT_VERSION,
		};
		const first = formFromEntry(translation({ version: 4, baseDoc: DOC }));
		const second = formFromEntry(translation({ baseDoc: reordered, version: 4 }));
		expect(first[TRANSLATION_FORM_KEY]).toBe(second[TRANSLATION_FORM_KEY]);
		expect(translationPayload(first)).toEqual({ version: 4, baseDoc: DOC });
	});

	it("a state of an older version is read as version 4, with the document of its source", () => {
		const fromText = translationPayload(formFromEntry(translation({ baseSource: "원문\n", version: 2 })));
		expect(fromText?.version).toBe(4);
		expect(fromText?.baseDoc.content.map((node) => node.type)).toEqual(["paragraph"]);
		const withDoc = translationPayload(formFromEntry(translation({ version: 3, baseSource: "원문\n", baseDoc: DOC })));
		expect(withDoc).toEqual({ version: 4, baseDoc: DOC });
	});

	it("a state with an invalid document is treated as unconfirmed", () => {
		const form = formFromEntry(translation({ version: 4, baseDoc: { type: "doc" } }));
		expect(translationPayload(form)).toEqual(EMPTY);
	});

	it("with no valid state, nothing is treated as confirmed", () => {
		for (const state of [null, undefined, { version: 1, units: [] }, { version: 2 }]) {
			expect(translationPayload(formFromEntry(translation(state)))).toEqual(EMPTY);
		}
		expect(translationStateFromForm("깨진 값")).toEqual(EMPTY);
		expect(translationStateFromForm(undefined)).toEqual(EMPTY);
	});

	it("the original does not send translation state", () => {
		expect(translationPayload(formFromEntry(entry({ translationGroupId: SOURCE })))).toBeUndefined();
	});
});
