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

	it("a translation form holds the confirmed source as JSON with fixed key order and sends it in the save request", () => {
		// The server (JSONB) returns keys reordered.
		const form = formFromEntry(translation({ baseSource: "원문\n", version: 2 }));
		expect(form[TRANSLATION_FORM_KEY]).toBe(stringifyTranslation({ version: 2, baseSource: "원문\n" }));
		expect(translationPayload(form)).toEqual({ version: 2, baseSource: "원문\n" });
	});

	it("with no valid state, nothing is treated as confirmed", () => {
		for (const state of [null, undefined, { version: 1, units: [] }, { version: 2 }]) {
			expect(translationPayload(formFromEntry(translation(state)))).toEqual({ version: 2, baseSource: "" });
		}
		expect(translationStateFromForm("깨진 값")).toEqual({ version: 2, baseSource: "" });
		expect(translationStateFromForm(undefined)).toEqual({ version: 2, baseSource: "" });
	});

	it("the original does not send translation state", () => {
		expect(translationPayload(formFromEntry(entry({ translationGroupId: SOURCE })))).toBeUndefined();
	});
});
