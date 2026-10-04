import { describe, expect, it } from "vitest";
import {
	CUSTOM_BLOCKS,
	customBaseSchema,
	customDefinition,
	customEngines,
	customResults,
	surfaceProblem,
} from "../custom";

// 예시 설정(`ai/test/cms.config.ts`)은 블록 확장의 블록과 사용자 블록 `notice`·`embed`를 쓴다.
describe("화면 기능의 블록 자리", () => {
	it("고를 수 있는 블록은 편집기 노드로 편집하는 더한 블록이다(자식 전용·원문 상자 제외)", () => {
		const names = CUSTOM_BLOCKS.map((block) => block.name);
		expect(names).toEqual(expect.arrayContaining(["callout", "tabs", "mermaid", "chart", "notice"]));
		expect(names).not.toContain("tab");
		expect(names).not.toContain("embed");
		expect(names).not.toContain("image");
	});

	it("블록 자리는 MDX 결과만 고르고, 없는 블록은 알린다", () => {
		const base = (result: string, block = "mermaid") =>
			customBaseSchema.safeParse({ label: "고치기", surface: { slot: "block", block }, result });
		expect(base("mdx").success).toBe(true);
		expect(base("text").success).toBe(false);
		expect(surfaceProblem({ slot: "block", block: "mermaid" })).toBeNull();
		expect(surfaceProblem({ slot: "block", block: "nope" })).toBe("없는 블록입니다: nope");
	});

	it("블록 자리 기능은 블록 원문을 받아 흘려받는다", () => {
		const definition = customDefinition({ label: "고치기", surface: { slot: "block", block: "chart" }, result: "mdx" });
		expect(Object.keys(definition.input)).toEqual(["block", "title"]);
		expect(definition.input.block).toMatchObject({ kind: "mdx", required: true });
		expect(definition.stream).toBe(true);
		expect(definition.attach).toEqual([{ slot: "block", block: "chart" }]);
	});
});

// 예시 설정의 글(post): 태그(`tagIds`, 여러 개), 카테고리(`categoryId`, 하나), 정책(`policy`, 선택 필드).
describe("화면 기능의 관계·선택 필드", () => {
	const field = (name: string) => ({ slot: "field" as const, field: name, collections: ["post"] });

	it("관계·선택 필드는 후보만, 판단·생성 방식을 고른다. 글 필드는 생성 방식만이다", () => {
		expect(customResults(field("tagIds"))).toEqual(["candidates"]);
		expect(customEngines(field("tagIds"))).toEqual(["decide", "generate"]);
		expect(customEngines(field("policy"))).toEqual(["decide", "generate"]);
		expect(customEngines(field("title"))).toEqual(["generate"]);
		const base = (patch: object) => customBaseSchema.safeParse({ label: "태그", result: "candidates", ...patch });
		expect(base({ surface: field("tagIds"), engine: "decide" }).success).toBe(true);
		expect(base({ surface: field("tagIds"), result: "text" }).success).toBe(false);
		expect(base({ surface: field("title"), engine: "decide" }).success).toBe(false);
	});

	it("관계 필드 기능은 가리키는 컬렉션에서 고르고, 여러 개 필드는 더한다", () => {
		const tags = customDefinition({ label: "태그", surface: field("tagIds"), result: "candidates", engine: "decide" });
		expect(tags).toMatchObject({
			engine: "decide",
			choices: { from: "collection", collection: "tag" },
			pick: "many",
			apply: "append",
			result: "candidates",
			checks: [{ kind: "exists" }],
		});
		const category = customDefinition({ label: "카테고리", surface: field("categoryId"), result: "candidates" });
		expect(category).toMatchObject({
			engine: "generate",
			choices: { from: "collection", collection: "category" },
			pick: "one",
		});
		expect(category.apply).toBeUndefined();
		const policy = customDefinition({
			label: "정책",
			surface: field("policy"),
			result: "candidates",
			engine: "decide",
		});
		expect(policy.choices).toEqual({ from: "select", collection: "post", field: "policy" });
		expect(surfaceProblem(field("tagIds"))).toBeNull();
	});
});
