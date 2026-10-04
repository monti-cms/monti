import { describe, expect, it, vi } from "vitest";
import type { SchemaCollection } from "../derive";

// 블로그와 필드 이름이 다른 사이트. 라이브러리가 이름이 아니라 역할·`from`으로 필드를 찾는지 본다.
vi.mock("../../config/resolved", async () => {
	const { defineCollection, defineConfig, fields } = await import("../..");
	const article = defineCollection({
		label: "Article",
		kind: "document",
		fields: {
			title: fields.text({ label: "Title", required: true }),
			headline: fields.text({ label: "Headline" }),
			slug: fields.slug({ label: "Slug", from: "headline", required: true }),
			excerpt: fields.text({ label: "Excerpt", role: "summary", fillFromBody: true }),
			topicId: fields.relation({ label: "Topic", to: "topic", required: true }),
			hero: fields.media({ label: "Hero", role: "heroImage", tab: "Media" }),
			robots: fields.select({
				label: "Robots",
				role: "noindex",
				options: { index: "Index", noindex: "No index" },
				defaultValue: "index",
			}),
		},
		layout: [{ tab: "Search", fields: ["robots"] }],
		list: { columns: ["title", "slug"] },
	});
	const topic = defineCollection({
		label: "Topic",
		kind: "item",
		fields: { title: fields.text({ label: "Name" }), slug: fields.slug({ label: "Slug" }) },
		list: { columns: [] },
	});
	const config = defineConfig({
		collections: { article, topic },
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	});
	return { cmsConfig: config };
});

const {
	fieldValueError,
	fillFromBodyFields,
	metadataReferences,
	missingRequiredIssues,
	roleField,
	roleValue,
	slugFromValues,
} = await import("../derive");
// 이 파일의 컬렉션은 위에서 바꾼 설정에만 있다(타입은 패키지 테스트 설정을 본다).
const article = "article" as SchemaCollection;
const topic = "topic" as SchemaCollection;

describe("field roles", () => {
	it("finds fields by role, not by name", () => {
		expect(roleField(article, "summary")?.name).toBe("excerpt");
		expect(roleField(article, "noindex")?.field.kind).toBe("select");
		expect(roleField(article, "seoTitle")).toBeUndefined();
		// 본체가 모르는 역할도 이름으로 찾는다(종류는 그 역할을 쓰는 확장이 정한다).
		expect(roleField(article, "heroImage")?.name).toBe("hero");
		expect(roleValue(article, "summary", { excerpt: "Short", summary: "Not this" })).toBe("Short");
		expect(roleValue(topic, "summary", { summary: "x" })).toBe("");
	});

	it("lists fields filled from the body", () => {
		expect(fillFromBodyFields(article).map((stored) => stored.name)).toEqual(["excerpt"]);
		expect(fillFromBodyFields(topic)).toEqual([]);
	});
});

describe("media fields", () => {
	const MEDIA = "11111111-1111-4111-8111-111111111111";
	const TOPIC = "22222222-2222-4222-8222-222222222222";

	it("collects the media ID as a media reference next to relation references", () => {
		expect(metadataReferences(article, { topicId: TOPIC, hero: MEDIA })).toEqual([
			{ kind: "entry", targetId: TOPIC, path: "topicId" },
			{ kind: "media", targetId: MEDIA, path: "hero" },
		]);
		expect(metadataReferences(article, { hero: "" })).toEqual([]);
	});

	it("accepts a media ID or an empty value", () => {
		const hero = roleField(article, "heroImage")?.field;
		if (!hero) throw new Error("hero");
		expect(fieldValueError(hero, MEDIA)).toBeNull();
		expect(fieldValueError(hero, "")).toBeNull();
		expect(fieldValueError(hero, "hero.png")).toBe("invalid_metadata_value");
	});
});

describe("slug from", () => {
	it("makes the slug from the field named by `from`", () => {
		expect(slugFromValues(article, { title: "Ignored", headline: "Hello World" })).toBe("hello-world");
	});

	it("does not make a slug without `from`", () => {
		expect(slugFromValues(topic, { title: "Hello" })).toBe("");
	});
});

describe("missing required fields", () => {
	it("uses missing_field with the field label for every field, title included", () => {
		expect(missingRequiredIssues(article, { slug: null, metadata: { title: "" } })).toEqual([
			{ code: "null_slug", path: "slug" },
			{ code: "missing_field", path: "title", message: "Title" },
			{ code: "missing_field", path: "topicId", message: "Topic" },
		]);
	});
});
