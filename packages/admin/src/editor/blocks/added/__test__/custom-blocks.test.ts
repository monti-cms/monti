import type { BlockDefinition } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../../core/test/site";
import { docOf } from "../../../../test/mdx";
import { para, storedDoc } from "../../../../test/stored-doc";
import { buildBlockSlashCommands } from "../../../slash-command";
import { OPAQUE_BLOCK_NAME, storedToTiptap, tiptapToStored } from "../../../tiptap-content";
import { blockNodeName } from "..";
import { insertContentOf } from "../inserts";
import { addedNodeBlocks, defaultValues } from "../shared";

// Custom blocks of the example config (`packages/core/test/cms.config.ts`): `notice` (editor node container), `embed` (raw-source box).
describe("custom block editing", () => {
	it("EDIT-B2 insertable custom blocks appear in the slash menu", () => {
		const items = buildBlockSlashCommands(testSite);
		expect(items.find((item) => item.id === "notice")?.title).toBe("공지");
		expect(items.some((item) => item.id === "embed")).toBe(false);
	});
});

// The example config uses every block of the blocks extension (`@monti-cms/blocks`).
describe("editor representation of added blocks", () => {
	const block = (name: string) => {
		const found = addedNodeBlocks(testSite).find((candidate) => candidate.name === name);
		if (!found) throw new Error(name);
		return found;
	};

	it("EDIT-B2 inserted content follows the definition's initial value, otherwise default values and the minimum number of children", () => {
		const callout = insertContentOf(testSite, block("callout"));
		expect(callout.type).toBe(blockNodeName(block("callout")));
		expect(callout.attrs?.values).toEqual(block("callout").editor.insert?.values ?? defaultValues(block("callout")));
		// A body container without children starts with one paragraph holding the definition's starting text.
		expect(callout.content).toEqual([
			{ type: "paragraph", content: [{ type: "text", text: block("callout").editor.insert?.text }] },
		]);

		const tabs = insertContentOf(testSite, block("tabs"));
		expect(tabs.content).toHaveLength(block("tabs").children?.min ?? 1);

		const mermaid = insertContentOf(testSite, block("mermaid"));
		expect(mermaid.type).toBe(blockNodeName(block("mermaid")));
		expect(mermaid.attrs?.value).toBe(block("mermaid").editor.insert?.code);

		const notice = insertContentOf(testSite, block("notice"));
		expect(notice.type).toBe(blockNodeName(block("notice")));
		expect(notice.attrs?.values).toEqual(defaultValues(block("notice")));
		expect(notice.content).toHaveLength(1);
	});

	it("EDIT-B2 a body container with `insert.codeBlocks` starts with those code blocks instead of an empty paragraph", () => {
		const files: BlockDefinition = {
			name: "file-box",
			label: "Files",
			syntax: { kind: "container", directive: "file-box" },
			component: "FileBox",
			attributes: {},
			editor: {
				view: "node",
				insert: {
					codeBlocks: [
						{ language: "ts", title: "src/index.ts", code: "export {};" },
						{ language: "text", title: "docs/" },
						{ language: "json" },
					],
				},
			},
		};
		const content = insertContentOf(testSite, files);
		expect(content.type).toBe("cmsFileBox");
		expect(content.content).toEqual([
			{
				type: "codeBlock",
				attrs: { language: "ts", meta: 'title="src/index.ts"' },
				content: [{ type: "text", text: "export {};" }],
			},
			{ type: "codeBlock", attrs: { language: "text", meta: 'title="docs/"' } },
			{ type: "codeBlock", attrs: { language: "json", meta: null } },
		]);
		// Without `codeBlocks` the body is still one paragraph (with the initial text, if any).
		const plain = insertContentOf(testSite, { ...files, editor: { view: "node", insert: { text: "본문" } } });
		expect(plain.content).toEqual([{ type: "paragraph", content: [{ type: "text", text: "본문" }] }]);
	});
});
