import type { CmsNode } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { docOf, tiptapOf } from "../../test/mdx";
import { storedDoc, table, text } from "../../test/stored-doc";
import { converterForCms, converterForTiptap } from "../converters";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

/**
 * The chart block of the blocks extension stands for every code fence block with a preview: both test sites have it, and each fence block's
 * converter comes from the same factory (`fenceBlockConverter`), picked by its language.
 */
describe("block converter registry", () => {
	it("EDIT-B4 prefers a converter with matches and falls back to the default converter", () => {
		const chartNode = { type: "codeBlock", attrs: { language: "chart", value: "pie" } };
		const tsNode = { type: "codeBlock", attrs: { language: "typescript", value: "const x = 1;" } };

		expect(converterForCms(testSite, "codeBlock", chartNode)?.name).toBe("chart");
		expect(converterForCms(testSite, "codeBlock", tsNode)?.name).toBe("codeBlock");
		expect(converterForCms(testSite, "codeBlock")?.name).toBe("codeBlock");
		expect(converterForCms(testSite, "math")?.name).toBe("math");
		expect(converterForTiptap(testSite, "cmsChart")?.name).toBe("chart");
		expect(converterForTiptap(testSite, "cmsMath")?.name).toBe("math");
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
		["a chart", () => docOf('```chart\npie\n  "Apple": 40\n  "Banana": 60\n```')],
		[
			"a chart with its meta and case preserved",
			() => docOf('```Chart title="sales"\npie\n  "Apple": 40\n  "Banana": 60\n```'),
		],
		["math", () => storedDoc({ type: "math", attrs: { value: "x^2 + y^2 = z^2" } })],
	])("FMT-R2 round-trips %s through the editor", (_, build) => {
		const doc = build();
		expect(tiptapToStored(testSite, storedToTiptap(testSite, doc))).toEqual(doc);
	});

	it("FMT-R2 saves a preview block with its new value after it changes", () => {
		const firstBlock = (doc: ReturnType<typeof tiptapToStored>, index = 0): CmsNode | undefined => doc.content[index];

		// Chart
		const chartDoc = tiptapOf('```chart\npie\n  "A": 10\n```');
		const chartBlock = chartDoc.content?.find((b) => b.type === "cmsChart");
		expect(chartBlock?.attrs?.value).toBe('pie\n  "A": 10');
		if (chartBlock?.attrs) chartBlock.attrs.value = 'pie\n  "B": 20';
		expect(firstBlock(tiptapToStored(testSite, chartDoc))).toMatchObject({
			type: "codeBlock",
			attrs: { language: "chart", code: 'pie\n  "B": 20' },
		});

		// Math
		const mathDoc = tiptapOfMath("x^2");
		const mathBlock = mathDoc.content?.find((b) => b.type === "cmsMath");
		expect(mathBlock?.attrs?.value).toBe("x^2");
		if (mathBlock?.attrs) mathBlock.attrs.value = "y^2";
		expect(firstBlock(tiptapToStored(testSite, mathDoc))).toMatchObject({ type: "math", attrs: { value: "y^2" } });
	});
});

const tiptapOfMath = (value: string) => storedToTiptap(testSite, storedDoc({ type: "math", attrs: { value } }));
