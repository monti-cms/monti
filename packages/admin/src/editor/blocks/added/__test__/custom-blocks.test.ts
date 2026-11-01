import { type BlockDefinition, type CmsConfig, defineBlock } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../../../../core/test/site";
import { buildBlockSlashCommands } from "../../../slash-command";
import { blockNodeName } from "..";
import { insertContentOf } from "../inserts";
import { defaultValues } from "../shared";

/**
 * Blocks a site adds, defined here so the tests run on any site config: a container with an editor node and default values, a container with a
 * starting value, a group whose children have a minimum count, a code fence with starting code, and a one-line block shown as a raw-text box.
 */
const box = defineBlock({
	name: "test-box",
	label: "Box",
	syntax: { kind: "container", directive: "test-box" },
	component: "TestBox",
	attributes: {
		level: { type: "string", label: "Level", options: { info: "Info", warn: "Warn" }, defaultValue: "info" },
	},
	editor: { view: "node", insertable: true, keywords: ["box"] },
});
const starter = defineBlock({
	name: "test-starter",
	label: "Starter",
	syntax: { kind: "container", directive: "test-starter" },
	component: "TestStarter",
	attributes: { variant: { type: "string", label: "Variant", defaultValue: "note" } },
	editor: { view: "node", insertable: true, insert: { values: { variant: "tip" }, text: "starting text" } },
});
const group = defineBlock({
	name: "test-group",
	label: "Group",
	syntax: { kind: "container", directive: "test-group" },
	component: "TestGroup",
	attributes: {},
	children: { blocks: ["test-item"], min: 2, max: 4 },
	editor: { view: "node", insertable: true },
});
const item = defineBlock({
	name: "test-item",
	label: "Item",
	parent: "test-group",
	syntax: { kind: "container", directive: "test-item" },
	component: "TestItem",
	attributes: {},
	editor: { view: "node" },
});
const fence = defineBlock({
	name: "test-fence",
	label: "Fence",
	syntax: { kind: "fence", lang: "test-fence" },
	component: "TestFence",
	attributes: {},
	editor: { view: "node", insertable: true, insert: { code: "start here" } },
});
const raw = defineBlock({
	name: "test-raw",
	label: "Raw",
	syntax: { kind: "leaf", directive: "test-raw" },
	component: "TestRaw",
	attributes: { url: { type: "string", label: "URL", required: true } },
	editor: { view: "opaque" },
});
const ADDED = [box, starter, group, item, fence, raw];

describe("custom block editing", () => {
	it("EDIT-B2 insertable custom blocks appear in the slash menu", () => {
		const site = createSite({ ...testConfig, blocks: [...(testConfig.blocks ?? []), ...ADDED] } as CmsConfig);
		const items = buildBlockSlashCommands(site);
		expect(items.find((entry) => entry.id === box.name)?.title).toBe(box.label);
		expect(items.some((entry) => entry.id === raw.name)).toBe(false);
	});
});

describe("editor representation of added blocks", () => {
	const blocks = { ADDED_BLOCKS: ADDED };

	it("EDIT-B2 inserted content follows the definition's initial value, otherwise default values and the minimum number of children", () => {
		const started = insertContentOf(blocks, starter);
		expect(started.type).toBe(blockNodeName(starter));
		expect(started.attrs?.values).toEqual({ variant: "tip" });
		// A body container without children starts with one paragraph holding the definition's starting text.
		expect(started.content).toEqual([{ type: "paragraph", content: [{ type: "text", text: "starting text" }] }]);

		const grouped = insertContentOf(blocks, group);
		expect(grouped.content).toHaveLength(2);
		expect(grouped.content?.map((child) => child.type)).toEqual([blockNodeName(item), blockNodeName(item)]);

		const fenced = insertContentOf(blocks, fence);
		expect(fenced.type).toBe(blockNodeName(fence));
		expect(fenced.attrs?.value).toBe("start here");

		const boxed = insertContentOf(blocks, box);
		expect(boxed.type).toBe(blockNodeName(box));
		expect(boxed.attrs?.values).toEqual(defaultValues(box));
		expect(boxed.attrs?.values).toEqual({ level: "info" });
		expect(boxed.content).toHaveLength(1);
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
