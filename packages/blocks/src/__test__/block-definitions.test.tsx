import { BLOCK_NODES } from "@monti-cms/admin/editor";
import { invalidOptionAttributes } from "@monti-cms/core/client";
import { analyze, directivesOf, serialize, toDocument } from "@monti-cms/mdx/format";
import { renderFixture } from "@monti-cms/mdx/testing";
import { directiveSyntax } from "@monti-cms/syntax-directive";
import { describe, expect, it } from "vitest";
import { renderSite as site } from "../test/render-config";

const { DIRECTIVES } = directivesOf(site);

describe("block definitions", () => {
	it("survives a JSON round trip unchanged — no functions or components", () => {
		expect(JSON.parse(JSON.stringify(site.BLOCKS))).toEqual(site.BLOCKS);
	});

	it("has no duplicate names and child/parent blocks actually exist", () => {
		expect(new Set(site.BLOCKS.map((block) => block.name)).size).toBe(site.BLOCKS.length);
		for (const block of site.BLOCKS) {
			for (const child of ("children" in block ? block.children?.blocks : undefined) ?? []) {
				expect(site.BLOCK_BY_NAME.get(child)?.parent, `${block.name} → ${child}`).toBe(block.name);
			}
			if ("parent" in block && block.parent) expect(site.BLOCK_BY_NAME.has(block.parent)).toBe(true);
		}
	});

	it("has implementations in the editor NodeView registry", () => {
		for (const block of site.BLOCKS) {
			// Core blocks use the editor node from the registry; added blocks (block extensions) use the node built from the definition.
			if (block.editor.view === "node" && block.editor.nodeView) {
				expect(BLOCK_NODES[block.editor.nodeView], `${block.name}.editor.nodeView`).toBeDefined();
			}
		}
	});

	it("keeps options and defaults consistent, and finds attributes outside the options", () => {
		for (const block of site.BLOCKS) {
			for (const [name, attribute] of Object.entries(block.attributes)) {
				if (attribute.options && typeof attribute.defaultValue === "string") {
					expect(Object.keys(attribute.options), `${block.name}.${name}`).toContain(attribute.defaultValue);
				}
			}
		}
		const callout = site.BLOCK_BY_NAME.get("callout");
		expect(callout && invalidOptionAttributes(callout, { variant: "caution" })).toEqual(["variant"]);
		expect(callout && invalidOptionAttributes(callout, { variant: "tip", title: "x" })).toEqual([]);
	});

	it("every registered directive round-trips parse -> document -> serialize, and renders without unknown nodes", async () => {
		// The directive notation is opt-in (`mdx.syntax`), so the extension is passed explicitly.
		const syntax = [directiveSyntax()];
		const blockOf = (name: string) => site.BLOCK_BY_NAME.get(name);
		/** Required attributes plus `mediaId` (an image without media is stored as plain markdown), each with a valid value. */
		const attributesOf = (name: string) =>
			Object.entries(blockOf(name)?.attributes ?? {})
				.filter(([key, attribute]) => attribute.required || key === "mediaId")
				.map(([key, attribute]) => {
					const option = attribute.options ? Object.keys(attribute.options)[0] : undefined;
					return `${key}="${option ?? "x"}"`;
				})
				.join(" ");
		const covered = new Set<string>();
		const childOf = (name: string) => {
			const childName = blockOf(name)?.children?.blocks?.[0];
			return DIRECTIVES.find((candidate) => candidate.name === childName);
		};
		/** Container nesting below a directive. An outer fence needs more colons than the containers inside it. */
		const heightOf = (name: string): number => {
			const child = childOf(name);
			return child?.kind === "container" ? 1 + heightOf(child.name) : 0;
		};
		/** The source of one directive; container blocks nest their minimum number of children (one at least). */
		const sourceOf = (directive: (typeof DIRECTIVES)[number]): string => {
			covered.add(directive.name);
			const attributes = attributesOf(directive.name);
			const braces = attributes ? `{${attributes}}` : "";
			// The line break carries no label (it is always saved as `<br />`), so it is written with the empty label.
			if (directive.kind === "text") {
				return `before :${directive.name}[${directive.name === "br" ? "" : "inside"}]${braces} after\n`;
			}
			if (directive.kind === "leaf") return `::${directive.name}${braces}\n`;
			const child = childOf(directive.name);
			const count = Math.max(blockOf(directive.name)?.children?.min ?? 0, child ? 1 : 0);
			const body = child ? Array.from({ length: count }, () => sourceOf(child)).join("\n") : "inside\n";
			const fence = ":".repeat(3 + heightOf(directive.name));
			return `${fence}${directive.name}${braces}\n${body}${fence}\n`;
		};

		// Child blocks (tab, row, cell, column) are exercised through their parent.
		for (const directive of DIRECTIVES.filter((candidate) => !blockOf(candidate.name)?.parent)) {
			const source = sourceOf(directive);
			const analysis = analyze(site, source, undefined, syntax);
			expect(analysis.errors, directive.name).toEqual([]);
			const document = toDocument(site, analysis);
			const saved = serialize(site, document, syntax);
			// The directive is still stored as a directive (it was not turned back into body text). The line break is always `<br />`.
			if (directive.name !== "br") expect(saved, directive.name).toContain(`:${directive.name}`);
			expect(saved, directive.name).toContain(directive.name);
			// Saving is stable: parsing the saved text gives the same document and the same text again.
			const reparsed = toDocument(site, analyze(site, saved, undefined, syntax));
			expect(reparsed, directive.name).toEqual(document);
			expect(serialize(site, reparsed, syntax), directive.name).toBe(saved);
			// Without the extension the same document is stored in the standard notation, and that is stable too.
			const standard = serialize(site, document);
			expect(standard, directive.name).not.toContain(`:${directive.name}`);
			const standardDocument = toDocument(site, analyze(site, standard));
			expect(standardDocument, directive.name).toEqual(document);
			expect(serialize(site, standardDocument), directive.name).toBe(standard);
			// The public page draws it with the block's own component, never the fallback.
			const rendered = await renderFixture(source, { site, syntax });
			expect(rendered.unknown, directive.name).toEqual([]);
		}
		expect([...covered].sort()).toEqual(DIRECTIVES.map((directive) => directive.name).sort());
	});
});
