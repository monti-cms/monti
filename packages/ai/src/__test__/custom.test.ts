import { describe, expect, it } from "vitest";
import {
	CUSTOM_BLOCKS,
	customBaseSchema,
	customDefinition,
	customEngines,
	customResults,
	surfaceProblem,
} from "../custom";

// The example config (`ai/test/cms.config.ts`) uses the blocks of the block extension and the user blocks `notice` and `embed`.
describe("block slot of screen actions", () => {
	it("selectable blocks are added blocks edited as editor nodes (excluding child-only and raw-source boxes)", () => {
		const names = CUSTOM_BLOCKS.map((block) => block.name);
		expect(names).toEqual(expect.arrayContaining(["callout", "tabs", "mermaid", "chart", "notice"]));
		expect(names).not.toContain("tab");
		expect(names).not.toContain("embed");
		expect(names).not.toContain("image");
	});

	it("the block slot accepts only MDX results and reports unknown blocks", () => {
		const base = (result: string, block = "mermaid") =>
			customBaseSchema.safeParse({ label: "고치기", surface: { slot: "block", block }, result });
		expect(base("mdx").success).toBe(true);
		expect(base("text").success).toBe(false);
		expect(surfaceProblem({ slot: "block", block: "mermaid" })).toBeNull();
		expect(surfaceProblem({ slot: "block", block: "nope" })).toContain("nope");
	});

	it("a block slot action takes the block source and streams the result", () => {
		const definition = customDefinition({ label: "고치기", surface: { slot: "block", block: "chart" }, result: "mdx" });
		expect(Object.keys(definition.input)).toEqual(["block", "title"]);
		expect(definition.input.block).toMatchObject({ kind: "mdx", required: true });
		expect(definition.stream).toBe(true);
		expect(definition.attach).toEqual([{ slot: "block", block: "chart" }]);
	});
});

// Post in the example config: tags (`tagIds`, many), category (`categoryId`, one), policy (`policy`, select field).
describe("relation and select fields of screen actions", () => {
	const field = (name: string) => ({ slot: "field" as const, field: name, collections: ["post"] });

	it("relation and select fields allow candidates only, with a choice of decide or generate mode; text fields allow generate mode only", () => {
		expect(customResults(field("tagIds"))).toEqual(["candidates"]);
		expect(customEngines(field("tagIds"))).toEqual(["decide", "generate"]);
		expect(customEngines(field("policy"))).toEqual(["decide", "generate"]);
		expect(customEngines(field("title"))).toEqual(["generate"]);
		const base = (patch: object) => customBaseSchema.safeParse({ label: "태그", result: "candidates", ...patch });
		expect(base({ surface: field("tagIds"), engine: "decide" }).success).toBe(true);
		expect(base({ surface: field("tagIds"), result: "text" }).success).toBe(false);
		expect(base({ surface: field("title"), engine: "decide" }).success).toBe(false);
	});

	it("relation field actions pick from the target collection, and multi-value fields append", () => {
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
