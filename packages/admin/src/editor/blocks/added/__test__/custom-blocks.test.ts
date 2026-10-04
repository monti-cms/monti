import { describe, expect, it } from "vitest";
import { buildBlockSlashCommands } from "../../../slash-command";
import { mdxToTiptap, OPAQUE_BLOCK_NAME, tiptapToMdx } from "../../../tiptap-content";
import { blockNodeName, insertContentOf } from "..";
import { ADDED_NODE_BLOCKS } from "../shared";

// Custom blocks of the example config (`packages/core/test/cms.config.ts`): `notice` (editor node container), `embed` (raw-source box).
describe("custom block editing", () => {
	it("a custom block with an editor node moves its attributes and body into the node and round-trips unchanged", () => {
		const mdx = ':::notice{level="warn" title="점검"}\n오늘 밤 점검합니다.\n:::\n';
		const json = mdxToTiptap(mdx);
		const node = json.content?.[0];
		expect(node?.type).toBe(blockNodeName({ name: "notice" }));
		expect(node?.type).toBe("cmsNotice");
		expect(node?.attrs?.values).toEqual({ level: "warn", title: "점검" });
		expect(node?.content?.[0]?.type).toBe("paragraph");
		expect(tiptapToMdx(json)).toBe(mdx);
	});

	it("a custom block set as a raw-source box is preserved as is", () => {
		const mdx = '::embed{url="https://example.com/video"}\n';
		const node = mdxToTiptap(mdx).content?.[0];
		expect(node?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(tiptapToMdx(mdxToTiptap(mdx))).toBe(mdx);
	});

	it("insertable custom blocks appear in the slash menu", () => {
		const items = buildBlockSlashCommands();
		expect(items.find((item) => item.id === "notice")?.title).toBe("공지");
		expect(items.some((item) => item.id === "embed")).toBe(false);
	});
});

// The example config uses every block of the blocks extension (`@monti-cms/blocks`).
describe("editor representation of added blocks", () => {
	const block = (name: string) => {
		const found = ADDED_NODE_BLOCKS.find((candidate) => candidate.name === name);
		if (!found) throw new Error(name);
		return found;
	};

	it("the slash menu lists added blocks (in config order) after the core blocks, and icons come from the definition", () => {
		const items = buildBlockSlashCommands();
		expect(items.map((item) => item.id)).toEqual([
			"callout",
			"collapsible",
			"tabs",
			"columns",
			"mermaid",
			"chart",
			"notice",
			"math",
		]);
		expect(items.find((item) => item.id === "mermaid")).toMatchObject({
			title: "다이어그램",
			description: "Mermaid 다이어그램·흐름도",
			icon: "workflow",
		});
	});

	it("inserted content follows the definition's initial value, otherwise default values and the minimum number of children", () => {
		expect(insertContentOf(block("callout"))).toEqual({
			type: "cmsCallout",
			attrs: { values: { variant: "info" }, originalAttributes: [] },
			content: [{ type: "paragraph", content: [{ type: "text", text: "내용을 입력하세요" }] }],
		});
		expect(insertContentOf(block("tabs")).content?.map((tab) => tab.attrs?.values)).toEqual([
			{ label: "첫 번째" },
			{ label: "두 번째" },
		]);
		expect(insertContentOf(block("mermaid"))).toEqual({
			type: "cmsMermaid",
			attrs: { value: "graph TD\n  A --> B", language: "mermaid" },
		});
		expect(insertContentOf(block("notice"))).toEqual({
			type: "cmsNotice",
			attrs: { values: { level: "info" }, originalAttributes: [] },
			content: [{ type: "paragraph" }],
		});
	});

	it("a code fence block moves that language's code block into a node and round-trips the meta", () => {
		const mdx = "```mermaid title=흐름\ngraph TD\n  A --> B\n```\n";
		const node = mdxToTiptap(mdx).content?.[0];
		expect(node).toMatchObject({ type: "cmsMermaid", attrs: { value: "graph TD\n  A --> B", meta: "title=흐름" } });
		expect(tiptapToMdx(mdxToTiptap(mdx))).toBe(mdx);
	});
});
