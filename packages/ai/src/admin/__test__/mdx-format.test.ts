// @vitest-environment jsdom

import { OPAQUE_BLOCK_NAME } from "@monti-cms/admin/editor";
import { createMdxBrowserFormat } from "@monti-cms/mdx/admin";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { contentOfText, documentOfText, textOfContent } from "../mdx-format";

const format = createMdxBrowserFormat(testSite);

describe("the text a model reads and writes", () => {
	it("is the mdx format's text for the editor's content, and back", () => {
		const content = contentOfText(testSite, format, "## 제목\n\n**굵게** 문단");
		expect(content.map((block) => block.type)).toEqual(["heading", "paragraph"]);
		expect(textOfContent(testSite, format, content)).toBe("## 제목\n\n**굵게** 문단");
	});

	it("keeps a text the format cannot read in a box, whole, instead of dropping or half reading it", () => {
		const text = "# 제목\n\n<Component>";
		const content = contentOfText(testSite, format, text);
		expect(content).toHaveLength(1);
		expect(content[0]?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(JSON.stringify(content[0])).toContain("Component");
		expect(documentOfText(format, text)).toBeNull();
	});

	it("reads a text that the format can read as a document, for a preview", () => {
		expect(documentOfText(format, "문단")?.content.map((block) => block.type)).toEqual(["paragraph"]);
	});
});
