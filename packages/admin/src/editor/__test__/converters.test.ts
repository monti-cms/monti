import type { CmsNode } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { docOf, tiptapOf } from "../../test/mdx";
import { storedDoc, table, text, withoutRowIds } from "../../test/stored-doc";
import { BLOCK_CONVERTERS, converterForCms, converterForTiptap } from "../converters";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

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
			"text-align",
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

	it.each<[string, () => ReturnType<typeof storedDoc>]>([
		[
			"an image",
			() => storedDoc({ type: "image", attrs: { mediaId: "m1", alt: "고양이", width: "50%", align: "left" } }),
		],
		["a code block", () => docOf('```ts title="a.ts"\nconst a = 1;\n```')],
		[
			"a table",
			() =>
				storedDoc(
					table(
						[
							[[text("a")], [text("b")]],
							[[text("1")], [text("2")]],
						],
						{ align: ["left", "right"] },
					),
				),
		],
		["a Mermaid diagram", () => docOf("```mermaid\ngraph TD;\n    A-->B;\n```")],
		["Mermaid with its case preserved", () => docOf("```Mermaid\ngraph TD;\n    A-->B;\n```")],
		["Mermaid with its meta preserved", () => docOf('```mermaid title="diagram.mmd"\ngraph TD;\n    A-->B;\n```')],
		["a chart", () => docOf('```chart\npie\n  "Apple": 40\n  "Banana": 60\n```')],
		[
			"a chart with its meta and case preserved",
			() => docOf('```Chart title="sales"\npie\n  "Apple": 40\n  "Banana": 60\n```'),
		],
		["math", () => storedDoc({ type: "math", attrs: { value: "x^2 + y^2 = z^2" } })],
	])("round-trips %s through the editor", (_, build) => {
		const doc = build();
		expect(tiptapToStored(storedToTiptap(doc))).toEqual(doc);
	});

	it("saves a preview block with its new value after it changes", () => {
		const firstBlock = (doc: ReturnType<typeof tiptapToStored>, index = 0): CmsNode | undefined => doc.content[index];

		// Mermaid
		const mermaidDoc = tiptapOf("```mermaid\ngraph TD;\n    A-->B;\n```");
		const mermaidBlock = mermaidDoc.content?.find((b) => b.type === "cmsMermaid");
		expect(mermaidBlock?.attrs?.value).toBe("graph TD;\n    A-->B;");
		if (mermaidBlock?.attrs) mermaidBlock.attrs.value = "graph LR;\n    C-->D;";
		expect(firstBlock(tiptapToStored(mermaidDoc))).toMatchObject({
			type: "codeBlock",
			attrs: { language: "mermaid", code: "graph LR;\n    C-->D;" },
		});

		// Chart
		const chartDoc = tiptapOf('```chart\npie\n  "A": 10\n```');
		const chartBlock = chartDoc.content?.find((b) => b.type === "cmsChart");
		expect(chartBlock?.attrs?.value).toBe('pie\n  "A": 10');
		if (chartBlock?.attrs) chartBlock.attrs.value = 'pie\n  "B": 20';
		expect(firstBlock(tiptapToStored(chartDoc))).toMatchObject({
			type: "codeBlock",
			attrs: { language: "chart", code: 'pie\n  "B": 20' },
		});

		// Math
		const mathDoc = tiptapOfMath("x^2");
		const mathBlock = mathDoc.content?.find((b) => b.type === "cmsMath");
		expect(mathBlock?.attrs?.value).toBe("x^2");
		if (mathBlock?.attrs) mathBlock.attrs.value = "y^2";
		expect(firstBlock(tiptapToStored(mathDoc))).toMatchObject({ type: "math", attrs: { value: "y^2" } });
	});
});

const tiptapOfMath = (value: string) => storedToTiptap(storedDoc({ type: "math", attrs: { value } }));
