import { type BlockDefinition, type CmsConfig, defineBlock } from "@monti-cms/core";
import type { CmsNode } from "@monti-cms/core/document";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import { createSite } from "@monti-cms/core/site";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import { buildEditorExtensions } from "../extensions";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

/**
 * Block ids anchor code refs, issues and translation pairing, so the editor must keep the ids a stored document has: through the conversion to the editor and back,
 * and through edits. These documents are built by hand with explicit ids on every block, including the rows and cells of a table and the children of a container.
 */

const withId = (id: string, node: CmsNode): CmsNode => ({ ...node, id });
const para = (id: string, value: string): CmsNode =>
	withId(id, { type: "paragraph", content: [{ type: "text", text: value }] });

const tableDoc: StoredDocument = {
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: [
		withId("tbl00001", {
			type: "table",
			content: [
				withId("row00001", {
					type: "tableRow",
					content: [
						withId("cel00001", { type: "tableCell", content: [{ type: "text", text: "a" }] }),
						withId("cel00002", { type: "tableCell", content: [{ type: "text", text: "b" }] }),
					],
				}),
				withId("row00002", {
					type: "tableRow",
					content: [
						withId("cel00003", { type: "tableCell", content: [{ type: "text", text: "c" }] }),
						withId("cel00004", { type: "tableCell", content: [{ type: "text", text: "d" }] }),
					],
				}),
			],
		}),
	],
};

/** A group of named children and a group of plain ones (the shapes of the blocks extension's tabs and columns), defined here for any site config. */
const pascal = (name: string) => name.replace(/(?:^|-)(\w)/g, (_, letter: string) => letter.toUpperCase());
const group = (name: string, child: string, childAttributes: BlockDefinition["attributes"]): BlockDefinition[] => [
	defineBlock({
		name,
		label: name,
		syntax: { kind: "container", directive: name },
		component: pascal(name),
		attributes: {},
		children: { blocks: [child], min: 2, max: 8 },
		editor: { view: "node", insertable: true },
	}),
	defineBlock({
		name: child,
		label: child,
		parent: name,
		syntax: { kind: "container", directive: child },
		component: pascal(child),
		attributes: childAttributes,
		editor: { view: "node" },
	}),
];
const containerSite = createSite({
	...testConfig,
	blocks: [
		...(testConfig.blocks ?? []),
		...group("test-panes", "test-pane", { label: { type: "string", label: "Name", required: true } }),
		...group("test-columns", "test-column", {}),
	],
} as CmsConfig);

const containersDoc: StoredDocument = {
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: [
		withId("tab00001", {
			type: "test-panes",
			content: [
				withId("tbi00001", { type: "test-pane", attrs: { label: "One" }, content: [para("par00011", "first")] }),
				withId("tbi00002", { type: "test-pane", attrs: { label: "Two" }, content: [para("par00012", "second")] }),
			],
		}),
		withId("col00001", {
			type: "test-columns",
			content: [
				withId("cli00001", { type: "test-column", content: [para("par00021", "left")] }),
				withId("cli00002", { type: "test-column", content: [para("par00022", "right")] }),
			],
		}),
	],
};

/** Every id in a document, in document order. */
const idsOf = (nodes: readonly CmsNode[] | undefined): string[] =>
	(nodes ?? []).flatMap((node) => [...(node.id ? [node.id] : []), ...idsOf(node.content)]);

const roundTrip = (doc: StoredDocument, site = testSite) => tiptapToStored(site, storedToTiptap(site, doc));

describe("block ids through the editor", () => {
	const keepsIds = (_: string, doc: StoredDocument) => {
		expect(idsOf(roundTrip(doc).content)).toEqual(idsOf(doc.content));
	};
	it.each([["a table with rows and cells", tableDoc] as const])(
		"TRANS-B1 %s keep their ids through storedToTiptap and tiptapToStored",
		keepsIds,
	);
	it("TRANS-B1 containers with their children keep their ids through storedToTiptap and tiptapToStored", () => {
		expect(idsOf(roundTrip(containersDoc, containerSite).content)).toEqual(idsOf(containersDoc.content));
	});

	it("TRANS-B1 keeps the ids of a table after its text is edited and a cell is typed into", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(testSite),
			content: storedToTiptap(testSite, tableDoc),
		});
		editor.commands.setTextSelection(4);
		editor.commands.insertContent("x");
		const saved = tiptapToStored(testSite, editor.getJSON());
		expect(idsOf(saved.content)).toEqual(
			expect.arrayContaining(idsOf(tableDoc.content).filter((id) => !id.startsWith("par"))),
		);
		expect(saved.content[0]?.id).toBe("tbl00001");
		editor.destroy();
	});

	it("TRANS-B1 keeps the ids of containers and their children after an edit inside them", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(containerSite),
			content: storedToTiptap(containerSite, containersDoc),
		});
		editor.commands.setTextSelection(editor.state.doc.content.size - 3);
		editor.commands.insertContent("!");
		const saved = tiptapToStored(containerSite, editor.getJSON());
		expect(idsOf(saved.content)).toEqual(
			expect.arrayContaining(["tab00001", "tbi00001", "tbi00002", "col00001", "cli00001", "cli00002"]),
		);
		editor.destroy();
	});
});
