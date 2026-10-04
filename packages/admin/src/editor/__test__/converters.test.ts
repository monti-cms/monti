import { describe, expect, it } from "vitest";
import { BLOCK_CONVERTERS, converterForCms, converterForTiptap } from "../converters";
import { mdxToTiptap, tiptapToMdx } from "../tiptap-content";

describe("블록 변환기 등록부(v2 C0)", () => {
	it("같은 노드 타입을 두 기본 변환기가 맡지 않는다(matches 분기 허용)", () => {
		const defaultCms = BLOCK_CONVERTERS.filter((c) => !c.matches).flatMap((c) => c.cmsTypes);
		const tiptap = BLOCK_CONVERTERS.flatMap((c) => c.tiptapTypes);
		expect(new Set(defaultCms).size).toBe(defaultCms.length);
		expect(new Set(tiptap).size).toBe(tiptap.length);
	});

	it("기본 분기가 맡는 타입을 등록부가 가리지 않는다", () => {
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

	it("타입으로 변환기를 찾는다", () => {
		expect(converterForCms("image")?.name).toBe("image");
		expect(converterForTiptap("codeBlock")?.name).toBe("codeBlock");
		expect(converterForCms("paragraph")).toBeUndefined();
	});

	it("matches가 있는 변환기를 우선하고 없으면 기본 변환기를 찾는다", () => {
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
		["이미지", '::image{mediaId="m1" alt="고양이" width="50%" align="left"}'],
		["코드 블록", '```ts title="a.ts"\nconst a = 1;\n```'],
		["표", "| a | b |\n| :-- | --: |\n| 1 | 2 |"],
		["Mermaid 다이어그램", "```mermaid\ngraph TD;\n    A-->B;\n```"],
		["Mermaid 대소문자 보존", "```Mermaid\ngraph TD;\n    A-->B;\n```"],
		["Mermaid meta 보존", '```mermaid title="diagram.mmd"\ngraph TD;\n    A-->B;\n```'],
		["차트", '```chart\npie\n  "Apple": 40\n  "Banana": 60\n```'],
		["차트 meta 및 대소문자 보존", '```Chart title="sales"\npie\n  "Apple": 40\n  "Banana": 60\n```'],
		["수식", "$$\nx^2 + y^2 = z^2\n$$"],
	])("%s를 왕복한다", (_, source) => {
		expect(tiptapToMdx(mdxToTiptap(source)).trim()).toBe(source);
	});

	it("미리보기 블록 값 변경 후 직렬화된다", () => {
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
