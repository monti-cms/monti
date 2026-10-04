import { describe, expect, it } from "vitest";
import { BLOCK_CONVERTERS, converterForCms, converterForTiptap } from "../converters";
import { mdxToTiptap, tiptapToMdx } from "../tiptap-content";

describe("block converter registry", () => {
	it("no two default converters handle the same node type (matches branches allowed)", () => {
		const defaultCms = BLOCK_CONVERTERS.filter((c) => !c.matches).flatMap((c) => c.cmsTypes);
		const tiptap = BLOCK_CONVERTERS.flatMap((c) => c.tiptapTypes);
		expect(new Set(defaultCms).size).toBe(defaultCms.length);
		expect(new Set(tiptap).size).toBe(tiptap.length);
	});

	it("the registry does not shadow types handled by the default branch", () => {
		const reserved = [
			"doc",
			"paragraph",
			"heading",
			"blockquote",
			"bulletList",
			"orderedList",
			"listItem",
			"taskList",
			"taskItem",
			"horizontalRule",
			"TextAlign",
			"tableRow",
			"tableCell",
			"tableHeader",
			"cmsOpaqueBlock",
			"text",
		];
		const claimed = BLOCK_CONVERTERS.flatMap((c) => [...c.cmsTypes, ...c.tiptapTypes]);
		expect(claimed.filter((type) => reserved.includes(type))).toEqual([]);
	});

	it("finds a converter by type", () => {
		expect(converterForCms("image")?.name).toBe("image");
		expect(converterForTiptap("codeBlock")?.name).toBe("codeBlock");
		expect(converterForCms("paragraph")).toBeUndefined();
	});

	it("prefers a converter with matches and falls back to the default converter", () => {
		const mermaidNode = { type: "codeBlock", attrs: { language: "mermaid", value: "graph TD" } };
		const chartNode = { type: "codeBlock", attrs: { language: "chart", value: "pie" } };
		const tsNode = { type: "codeBlock", attrs: { language: "typescript", value: "const x = 1;" } };

		expect(converterForCms("codeBlock", mermaidNode)?.name).toBe("mermaid");
		expect(converterForCms("codeBlock", chartNode)?.name).toBe("chart");
		expect(converterForCms("codeBlock", tsNode)?.name).toBe("codeBlock");
		expect(converterForCms("codeBlock")?.name).toBe("codeBlock");
		expect(converterForCms("math")?.name).toBe("math");
		expect(converterForTiptap("cmsMermaid")?.name).toBe("mermaid");
		expect(converterForTiptap("cmsChart")?.name).toBe("chart");
		expect(converterForTiptap("cmsMath")?.name).toBe("math");
	});

	it.each([
		["an image", '::image{mediaId="m1" alt="고양이" width="50%" align="left"}'],
		["a code block", '```ts title="a.ts"\nconst a = 1;\n```'],
		["a table", "| a | b |\n| :-- | --: |\n| 1 | 2 |"],
		["a Mermaid diagram", "```mermaid\ngraph TD;\n    A-->B;\n```"],
		["Mermaid with its case preserved", "```Mermaid\ngraph TD;\n    A-->B;\n```"],
		["Mermaid with its meta preserved", '```mermaid title="diagram.mmd"\ngraph TD;\n    A-->B;\n```'],
		["a chart", '```chart\npie\n  "Apple": 40\n  "Banana": 60\n```'],
		["a chart with its meta and case preserved", '```Chart title="sales"\npie\n  "Apple": 40\n  "Banana": 60\n```'],
		["math", "$$\nx^2 + y^2 = z^2\n$$"],
	])("round-trips %s", (_, source) => {
		expect(tiptapToMdx(mdxToTiptap(source)).trim()).toBe(source);
	});

	it("serializes after a preview block value changes", () => {
		// Mermaid
		const mermaidDoc = mdxToTiptap("```mermaid\ngraph TD;\n    A-->B;\n```");
		const mermaidBlock = mermaidDoc.content?.find((b) => b.type === "cmsMermaid");
		expect(mermaidBlock?.attrs?.value).toBe("graph TD;\n    A-->B;");
		if (mermaidBlock?.attrs) mermaidBlock.attrs.value = "graph LR;\n    C-->D;";
		expect(tiptapToMdx(mermaidDoc).trim()).toBe("```mermaid\ngraph LR;\n    C-->D;\n```");

		// Chart
		const chartDoc = mdxToTiptap('```chart\npie\n  "A": 10\n```');
		const chartBlock = chartDoc.content?.find((b) => b.type === "cmsChart");
		expect(chartBlock?.attrs?.value).toBe('pie\n  "A": 10');
		if (chartBlock?.attrs) chartBlock.attrs.value = 'pie\n  "B": 20';
		expect(tiptapToMdx(chartDoc).trim()).toBe('```chart\npie\n  "B": 20\n```');

		// Math
		const mathDoc = mdxToTiptap("$$\nx^2\n$$");
		const mathBlock = mathDoc.content?.find((b) => b.type === "cmsMath");
		expect(mathBlock?.attrs?.value).toBe("x^2");
		if (mathBlock?.attrs) mathBlock.attrs.value = "y^2";
		expect(tiptapToMdx(mathDoc).trim()).toBe("$$\ny^2\n$$");
	});
});
