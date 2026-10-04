import { BLOCK_NODE_VIEWS } from "@monti-cms/admin/editor";
import { BLOCK_BY_NAME, BLOCKS, invalidOptionAttributes } from "@monti-cms/core/client";
import { DIRECTIVES } from "@monti-cms/core/mdx";
import { describe, expect, it, vi } from "vitest";

// Run blocks with the config supplied by the plugin (`blocks()`), so public components come from the plugin `render`.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { mdxComponents } = await import("@monti-cms/core/render");

describe("block definitions", () => {
	it("survives a JSON round trip unchanged — no functions or components", () => {
		expect(JSON.parse(JSON.stringify(BLOCKS))).toEqual(BLOCKS);
	});

	it("has no duplicate names and child/parent blocks actually exist", () => {
		expect(new Set(BLOCKS.map((block) => block.name)).size).toBe(BLOCKS.length);
		for (const block of BLOCKS) {
			for (const child of ("children" in block ? block.children?.blocks : undefined) ?? []) {
				expect(BLOCK_BY_NAME.get(child)?.parent, `${block.name} → ${child}`).toBe(block.name);
			}
			if ("parent" in block && block.parent) expect(BLOCK_BY_NAME.has(block.parent)).toBe(true);
		}
	});

	it("has implementations in the public component map and the editor NodeView registry", async () => {
		const components = await mdxComponents();
		for (const block of BLOCKS) {
			const intrinsic = block.component === block.component.toLowerCase();
			if (!intrinsic && !("renderedBy" in block && block.renderedBy)) {
				expect(components[block.component], `${block.name}.component`).toBeDefined();
			}
			// Core blocks use the editor node from the registry; added blocks (block extensions) use the node built from the definition.
			if (block.editor.view === "node" && block.editor.nodeView) {
				expect(BLOCK_NODE_VIEWS[block.editor.nodeView], `${block.name}.editor.nodeView`).toBeDefined();
			}
		}
	});

	it("keeps options and defaults consistent, and finds attributes outside the options", () => {
		for (const block of BLOCKS) {
			for (const [name, attribute] of Object.entries(block.attributes)) {
				if (attribute.options && typeof attribute.defaultValue === "string") {
					expect(Object.keys(attribute.options), `${block.name}.${name}`).toContain(attribute.defaultValue);
				}
			}
		}
		const callout = BLOCK_BY_NAME.get("callout");
		expect(callout && invalidOptionAttributes(callout, { variant: "caution" })).toEqual(["variant"]);
		expect(callout && invalidOptionAttributes(callout, { variant: "tip", title: "x" })).toEqual([]);
	});

	it("builds the v1 directive table as is", () => {
		expect(
			DIRECTIVES.map((directive) => [directive.name, directive.kind, directive.component, directive.required]),
		).toEqual([
			["text-align", "container", "TextAlign", ["align"]],
			["image", "leaf", "Image", []],
			["file", "leaf", "File", ["mediaId"]],
			// Translation notice block. Wraps the source text of a new translation.
			["untranslated", "text", "Untranslated", []],
			["u", "text", "u", []],
			["sup", "text", "sup", []],
			["sub", "text", "sub", []],
			["br", "text", "br", []],
			["table", "container", "Table", []],
			["row", "container", "TableRow", []],
			["cell", "leaf", "TableCell", []],
			// Block extension (`@monti-cms/blocks`). Follows the `plugins` order in the site config.
			["callout", "container", "Callout", []],
			["collapsible", "container", "Collapsible", []],
			["tabs", "container", "Tabs", []],
			["tab", "container", "Tab", ["label"]],
			["columns", "container", "Columns", []],
			["column", "container", "Column", []],
			// Inline mark extension. Stored syntax and component names are unchanged.
			["tooltip", "text", "Tooltip", ["content"]],
			["code-ref", "text", "CodeRef", ["to"]],
			["color", "text", "Color", []],
		]);
		expect(DIRECTIVES.find((directive) => directive.name === "cell")?.attributes).toEqual({
			colspan: "string",
			rowspan: "string",
			header: "boolean",
		});
		expect(DIRECTIVES.find((directive) => directive.name === "image")?.attributes).toEqual({
			mediaId: "string",
			src: "string",
			alt: "string",
			width: "string",
			align: "string",
			caption: "string",
			decorative: "boolean",
			crop: "string",
			rotate: "string",
			title: "string",
		});
	});
});
