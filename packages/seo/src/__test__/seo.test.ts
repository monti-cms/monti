import { type CollectionsConfig, defineCollection, fields, valueFieldsOf } from "@monti-cms/core";
import { COLLECTIONS, cmsConfig, createTranslator, roleField, schemaOf } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { AI_ACTIONS } from "../../../ai/src/registry";
import { SEO_DEFAULT_KEYS, SEO_ROLES, seo, seoFields, seoOf, validateSeoFields } from "..";
import { seoMessages } from "../messages";

/**
 * SEO 확장(M10-2). 필드 묶음·설정 검사·공개 화면 도우미는 테스트 안에서 만든 정의로, AI 기능은 지금 설정(블로그 예시·
 * 다른 사이트 둘 다)에서 역할로 찾은 필드로 확인한다.
 */

describe("seoFields", () => {
	it("기본 이름·역할·탭으로 필드 묶음을 만든다", () => {
		const bundle = seoFields();
		expect(Object.keys(bundle)).toEqual(Object.values(SEO_DEFAULT_KEYS));
		expect(bundle.seoTitle).toMatchObject({ kind: "text", role: SEO_ROLES.title, tab: "SEO", localized: true });
		expect(bundle.seoTitle.inputOptions).toEqual({ limit: 60 });
		expect(bundle.seoImage).toMatchObject({ kind: "media", accept: "image", role: SEO_ROLES.image });
		expect(bundle.seoNoindex).toMatchObject({ kind: "select", role: "noindex", defaultValue: "index" });
		// 숨기기는 언제나 공통 값이다.
		expect(bundle.seoNoindex.localized).toBeUndefined();
		expect(bundle.seoPreview).toMatchObject({ kind: "view", view: "search", tab: "SEO" });
	});

	it("기본 이름표는 필드를 만들 때가 아니라 읽을 때 관리자 언어로 고른다(사이트가 정한 이름표는 그대로)", () => {
		const t = createTranslator(seoMessages);
		const bundle = seoFields({ labels: { canonical: "Canonical" } });
		expect(bundle.seoTitle.label).toBe(t("field.title"));
		expect(bundle.seoImage.label).toBe(t("field.image"));
		expect(bundle.seoNoindex.label).toBe(t("field.noindex"));
		expect(bundle.seoNoindex.options).toEqual({ index: t("option.index"), noindex: t("option.noindex") });
		expect(bundle.seoCanonical.label).toBe("Canonical");
		// 모든 언어 사전이 영어와 같은 이름표를 가진다.
		const missing = Object.keys(seoMessages.messages.en).filter((key) => !(key in (seoMessages.messages.ko ?? {})));
		expect(missing.every((key) => key.endsWith(".prompt"))).toBe(true);
	});

	it("이름·이름표·탭·언어별 값·권장 글자 수를 바꾸고 자리를 뺀다(저장된 이름을 그대로 쓴다)", () => {
		const bundle = seoFields({
			keys: { title: "metaTitle", image: "ogImageId" },
			labels: { title: "Meta title" },
			tab: "Search",
			localized: false,
			limits: { title: 70 },
			omit: ["canonical", "preview"],
		});
		expect(Object.keys(bundle)).toEqual(["metaTitle", "seoDescription", "ogImageId", "seoNoindex"]);
		expect(bundle.metaTitle).toMatchObject({ label: "Meta title", tab: "Search", inputOptions: { limit: 70 } });
		expect(bundle.metaTitle.localized).toBeUndefined();
	});
});

describe("설정 검사(`seo().validate`)", () => {
	const title = fields.text({ label: "Title" });
	const check = (extra: Parameters<typeof defineCollection>[0]["fields"]) => () =>
		validateSeoFields({
			collections: {
				page: defineCollection({
					label: "Page",
					kind: "document",
					fields: { title, ...extra },
					list: { columns: [] },
				}),
			} as CollectionsConfig,
		});

	it("SEO 역할이 맞는 종류의 필드에 붙었는지 본다", () => {
		expect(check(seoFields())).not.toThrow();
		expect(check({ image: fields.text({ label: "Image", role: "ogImage" }) })).toThrow(/needs a media field/);
		expect(check({ t: fields.media({ label: "T", role: "seoTitle" }) })).toThrow(/needs a text field/);
		expect(
			check({ robots: fields.select({ label: "R", role: "noindex", options: { a: "A" }, defaultValue: "a" }) }),
		).toThrow(/"noindex" option/);
		expect(seo().validate).toBe(validateSeoFields);
	});
});

describe("공개 화면 도우미(`seoOf`)", () => {
	const page = defineCollection({
		label: "Page",
		kind: "document",
		fields: {
			title: fields.text({ label: "Title" }),
			intro: fields.text({ label: "Intro", role: "summary" }),
			...seoFields({ keys: { title: "metaTitle", noindex: "robots" } }),
		},
		list: { columns: [] },
	});

	it("역할로 값을 읽고, 비운 제목·설명은 제목·요약으로 채운다", () => {
		expect(seoOf(page, { title: "Page", intro: "Intro text" })).toEqual({
			title: "Page",
			description: "Intro text",
			noindex: false,
		});
		expect(
			seoOf(page, {
				title: "Page",
				metaTitle: " Search title ",
				seoDescription: "Search text",
				seoImage: "11111111-1111-4111-8111-111111111111",
				seoCanonical: "https://a.dev/x",
				robots: "noindex",
			}),
		).toEqual({
			title: "Search title",
			description: "Search text",
			imageId: "11111111-1111-4111-8111-111111111111",
			canonical: "https://a.dev/x",
			noindex: true,
		});
	});
});

describe("지금 설정: AI 기능", () => {
	/** 그 역할 필드가 있는 (컬렉션, 필드). */
	const withRole = (role: string) =>
		COLLECTIONS.flatMap((collection) => {
			const stored = roleField(collection, role);
			return stored ? [`${collection}.${stored.name}`] : [];
		}).sort();
	const pairs = (key: string) =>
		(AI_ACTIONS[key]?.attach ?? [])
			.flatMap((attach) =>
				attach.slot === "field" ? (attach.collections ?? []).map((collection) => `${collection}.${attach.field}`) : [],
			)
			.sort();

	it("AI 플러그인이 있으면 검색 제목·설명 추천이 역할 필드에 붙는다(AI 설정에 적지 않아도)", () => {
		expect(withRole(SEO_ROLES.title).length).toBeGreaterThan(0);
		expect(pairs("seoTitle")).toEqual(withRole(SEO_ROLES.title));
		expect(pairs("seoDescription")).toEqual(withRole(SEO_ROLES.description));
	});

	it("추천 길이는 필드 `max` → 권장 글자 수(`limits`) → 기본값이다", () => {
		const collection = COLLECTIONS.find((name) => roleField(name, SEO_ROLES.title));
		const field = collection ? roleField(collection, SEO_ROLES.title)?.field : undefined;
		const limit = field?.kind === "text" ? (field.max ?? field.inputOptions?.limit ?? 60) : 60;
		expect(AI_ACTIONS.seoTitle?.checks).toEqual([{ kind: "maxLength", max: limit }]);
		expect(AI_ACTIONS.seoTitle?.prompt).toContain(`${limit} characters`);
	});

	it("SEO 필드는 모두 제 탭에 있다", () => {
		for (const collection of COLLECTIONS) {
			for (const { name, field } of valueFieldsOf(schemaOf(collection))) {
				if (Object.values(SEO_ROLES).includes(field.role as never)) expect(field.tab, name).toBeTruthy();
			}
		}
		expect(cmsConfig.plugins?.some((plugin) => plugin.name === "seo")).toBe(true);
	});
});
