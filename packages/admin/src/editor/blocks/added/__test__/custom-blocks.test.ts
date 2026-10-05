import { ADDED_BLOCKS } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { buildBlockSlashCommands } from "../../../slash-command";
import { mdxToTiptap, OPAQUE_BLOCK_NAME, tiptapToMdx } from "../../../tiptap-content";
import { blockNodeName, insertContentOf } from "..";
import { ADDED_NODE_BLOCKS, defaultValues } from "../shared";

// Custom blocks of the example config (`packages/core/test/cms.config.ts`): `notice` (editor node container), `embed` (raw-source box).
describe("custom block editing", () => {
	it("a custom block with an editor node moves its attributes and body into the node and round-trips unchanged", () => {
		const mdx = '<Notice level="warn" title="점검">\n\n오늘 밤 점검합니다.\n\n</Notice>\n';
		const json = mdxToTiptap(mdx);
		const node = json.content?.[0];
		expect(node?.type).toBe(blockNodeName({ name: "notice" }));
		expect(node?.type).toBe("cmsNotice");
		expect(node?.attrs?.values).toEqual({ level: "warn", title: "점검" });
		expect(node?.content?.[0]?.type).toBe("paragraph");
		expect(tiptapToMdx(json)).toBe(mdx);
	});

	it("a custom block set as a raw-source box is preserved as is", () => {
		const mdx = '<Embed url="https://example.com/video" />\n';
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
		const ids = items.map((item) => item.id);
		const added = ADDED_BLOCKS.map((candidate) => candidate.name).filter((name) => ids.includes(name));
		// Added blocks keep their config order relative to each other.
		expect(added.length).toBeGreaterThan(1);
		expect(added.map((name) => ids.indexOf(name))).toEqual(
			[...added.map((name) => ids.indexOf(name))].sort((a, b) => a - b),
		);
		// Core blocks (math) come after every added block.
		expect(ids.indexOf("math")).toBeGreaterThan(Math.max(...added.map((name) => ids.indexOf(name))));
		// The icon comes from the block definition.
		const mermaid = items.find((item) => item.id === "mermaid");
		expect(mermaid?.icon).toBe(block("mermaid").editor.icon);
	});

	it("inserted content follows the definition's initial value, otherwise default values and the minimum number of children", () => {
		const callout = insertContentOf(block("callout"));
		expect(callout.type).toBe(blockNodeName(block("callout")));
		expect(callout.attrs?.values).toEqual(block("callout").editor.insert?.values ?? defaultValues(block("callout")));
		expect(callout.content?.length).toBeGreaterThanOrEqual(1);

		const tabs = insertContentOf(block("tabs"));
		expect(tabs.content?.length).toBeGreaterThanOrEqual(block("tabs").children?.min ?? 1);

		const mermaid = insertContentOf(block("mermaid"));
		expect(mermaid.type).toBe(blockNodeName(block("mermaid")));
		expect(mermaid.attrs?.value).toBe(block("mermaid").editor.insert?.code);

		const notice = insertContentOf(block("notice"));
		expect(notice.type).toBe(blockNodeName(block("notice")));
		expect(notice.attrs?.values).toEqual(defaultValues(block("notice")));
		expect(notice.content).toHaveLength(1);
	});

	it("a code fence block moves that language's code block into a node and round-trips the meta", () => {
		const mdx = "```mermaid title=흐름\ngraph TD\n  A --> B\n```\n";
		const node = mdxToTiptap(mdx).content?.[0];
		expect(node).toMatchObject({ type: "cmsMermaid", attrs: { value: "graph TD\n  A --> B", meta: "title=흐름" } });
		expect(tiptapToMdx(mdxToTiptap(mdx))).toBe(mdx);
	});
});
