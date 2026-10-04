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

describe("번역본 폼(v2 B4)", () => {
	it("번역본은 언어별 값만 폼과 메타데이터로 다룬다", () => {
		const translation = entry({
			id: "33333333-3333-4333-8333-333333333333",
			translationGroupId: SOURCE,
			locale: "en",
			publishedAt: "2026-01-01T00:00:00.000Z",
			working: { metadata: { title: "Hello", summary: "Sum" }, mdx: "Body" },
		});
		const form = formFromEntry(translation);
		// 번역 상태(`$translation`, v3)도 폼이 다룬다. 저장 필드가 아니라 메타데이터에는 들어가지 않는다.
		expect(Object.keys(form).sort()).toEqual([
			"$translation",
			"canonicalUrl",
			"mdx",
			"ogImageId",
			"seoDescription",
			"seoTitle",
			"slug",
			"summary",
			"title",
		]);
		expect(
			metadataFromForm(
				{ ...form, categoryId: CATEGORY, publishedAt: "2026-01-01T09:00" },
				"post",
				{},
				{ translation: true },
			),
		).toEqual({ metadata: { title: "Hello", summary: "Sum" } });
	});

	it("원문은 공통 값도 다룬다", () => {
		const form = formFromEntry(entry({ working: { metadata: { title: "안녕", categoryId: CATEGORY }, mdx: "" } }));
		expect(form.categoryId).toBe(CATEGORY);
		expect(metadataFromForm(form, "post")).toEqual({ metadata: { title: "안녕", categoryId: CATEGORY } });
	});
});

describe("record 언어별 이름(v2 B4)", () => {
	it("다른 언어 이름을 폼 키로 읽고 비운 언어는 저장하지 않는다", () => {
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

describe("번역 상태 폼(v3)", () => {
	const translation = (state: unknown) =>
		entry({
			id: "33333333-3333-4333-8333-333333333333",
			translationGroupId: SOURCE,
			locale: "en",
			working: { metadata: { title: "Hello" }, mdx: "Body", translation: state as never },
		});

	it("번역본 폼은 확인한 원문을 고정된 키 순서의 JSON으로 담고 저장 요청에 싣는다", () => {
		// 서버(JSONB)는 키 순서를 바꿔 돌려준다.
		const form = formFromEntry(translation({ baseSource: "원문\n", version: 2 }));
		expect(form[TRANSLATION_FORM_KEY]).toBe(stringifyTranslation({ version: 2, baseSource: "원문\n" }));
		expect(translationPayload(form)).toEqual({ version: 2, baseSource: "원문\n" });
	});

	it("유효한 상태가 없으면 아무것도 확인하지 않은 것으로 둔다", () => {
		for (const state of [null, undefined, { version: 1, units: [] }, { version: 2 }]) {
			expect(translationPayload(formFromEntry(translation(state)))).toEqual({ version: 2, baseSource: "" });
		}
		expect(translationStateFromForm("깨진 값")).toEqual({ version: 2, baseSource: "" });
		expect(translationStateFromForm(undefined)).toEqual({ version: 2, baseSource: "" });
	});

	it("원문은 번역 상태를 보내지 않는다", () => {
		expect(translationPayload(formFromEntry(entry({ translationGroupId: SOURCE })))).toBeUndefined();
	});
});
