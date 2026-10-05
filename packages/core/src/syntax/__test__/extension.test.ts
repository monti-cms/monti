import type { Root } from "mdast";
import { renderToStaticMarkup } from "react-dom/server";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import { mdxWith } from "../../../test/mdx-syntax";
import type { CmsNode } from "../../mdx";
import { renderMdx } from "../../render";
import type { SyntaxExtension } from "..";

/** The extension interface: what an extension can read, write and escape, and how several of them combine. Uses made-up notations, not the directive one. */

const text = (value: string, marks?: CmsNode["marks"]): CmsNode => ({
	type: "text",
	text: value,
	...(marks ? { marks } : {}),
});
const paragraph = (...content: CmsNode[]): CmsNode => ({ type: "paragraph", content });
const doc = (...content: CmsNode[]): CmsNode => ({ type: "doc", content });

describe("syntax extensions: writing", () => {
	it("an extension writes a mark around the already written content", () => {
		const braces: SyntaxExtension = {
			name: "braces",
			fromMark: { underline: (_mark, inner) => `{u ${inner}}` },
		};
		const { serialize } = mdxWith([braces]);
		expect(serialize(doc(paragraph(text("밑줄", [{ type: "underline" }]))))).toBe("{u 밑줄}\n");
	});

	it("the standard notation is written where an extension has no writer or defers", () => {
		const defers: SyntaxExtension = {
			name: "defers",
			fromMark: { "*": () => undefined },
			fromDocument: { "*": () => undefined },
		};
		const content = doc(paragraph(text("a", [{ type: "underline" }]), text("b", [{ type: "bold" }])));
		expect(mdxWith([defers]).serialize(content)).toBe(mdxWith([]).serialize(content));
		expect(mdxWith([]).serialize(content)).toBe("<u>a</u>**b**\n");
	});

	it("the first extension that does not defer wins, in list order", () => {
		const writer = (name: string, answer: string | undefined): SyntaxExtension => ({
			name,
			fromDocument: { horizontalRule: () => answer },
		});
		const rule = doc({ type: "horizontalRule" });
		expect(mdxWith([writer("a", "AAA"), writer("b", "BBB")]).serialize(rule)).toBe("AAA\n");
		expect(mdxWith([writer("a", undefined), writer("b", "BBB")]).serialize(rule)).toBe("BBB\n");
		expect(mdxWith([writer("a", undefined), writer("b", undefined)]).serialize(rule)).toBe("---\n");
	});

	it("a specific node type is tried before the wildcard of the same extension", () => {
		const extension: SyntaxExtension = {
			name: "both",
			fromDocument: {
				horizontalRule: () => "specific",
				"*": (node) => (node.type === "horizontalRule" ? "wild" : undefined),
			},
		};
		expect(mdxWith([extension]).serialize(doc({ type: "horizontalRule" }))).toBe("specific\n");
	});

	it("never offers a line break to an extension", () => {
		const greedy: SyntaxExtension = {
			name: "greedy",
			fromDocument: { hardBreak: () => "<<br>>", "*": (node) => (node.type === "paragraph" ? undefined : "<<any>>") },
		};
		const written = mdxWith([greedy]).serialize(doc(paragraph(text("가"), { type: "hardBreak" }, text("나"))));
		expect(written).toBe("가<br />\n나\n");
	});

	it("body text is escaped by every extension, but code text is not", () => {
		const at: SyntaxExtension = { name: "at", escapeText: (value) => value.replace(/@/g, "\\@") };
		const { serialize } = mdxWith([at]);
		expect(serialize(doc(paragraph(text("a@b"))))).toBe("a\\@b\n");
		expect(serialize(doc(paragraph(text("a@b", [{ type: "code" }]))))).toBe("`a@b`\n");
	});

	it("escaping knows whether the text is inside a label and which marks wrap it", () => {
		const seen: { label: boolean; marks: string[] }[] = [];
		const spy: SyntaxExtension = {
			name: "spy",
			escapeText: (value, context) => {
				seen.push({ label: context.label, marks: context.marks.map((mark) => mark.type) });
				return value;
			},
		};
		mdxWith([spy]).serialize(
			doc(
				paragraph(text("plain"), text("linked", [{ type: "link", attrs: { href: "/a" } }])),
				paragraph({ type: "image", attrs: { src: "/a.png", alt: "대체" } }),
			),
		);
		expect(seen).toEqual([
			{ label: false, marks: [] },
			{ label: true, marks: ["link"] },
			{ label: true, marks: [] },
		]);
	});

	it("a block writer can write its children, sees the indentation and the site's blocks", () => {
		const seen: { indent: string; align?: string }[] = [];
		const box: SyntaxExtension = {
			name: "box",
			fromDocument: {
				TextAlign: (node, context) => {
					const block = context.blocks.byComponent(context.componentName(node));
					seen.push({ indent: context.indent, align: block?.attributes.align ? String(node.attrs?.align) : undefined });
					return `${context.indent}[[ ${context.serializeBlocks(node.content ?? [])} ]]`;
				},
			},
		};
		const align: CmsNode = { type: "TextAlign", attrs: { align: "center" }, content: [paragraph(text("안"))] };
		const written = mdxWith([box]).serialize(
			doc({ type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("항목")), align] }] }),
		);
		expect(written).toBe("- 항목\n\n  [[ 안 ]]\n");
		expect(seen).toEqual([{ indent: "  ", align: "center" }]);
	});

	it("shows attributes of a block the way the standard notation writes them", () => {
		const probe: SyntaxExtension = {
			name: "probe",
			fromDocument: {
				TextAlign: (node, context) => {
					const block = context.blocks.byComponent("TextAlign");
					return block ? `probe ${context.nodeAttributes(node, block).join(" ")}` : undefined;
				},
			},
		};
		const align: CmsNode = { type: "TextAlign", attrs: { align: "center" }, content: [paragraph(text("안"))] };
		expect(mdxWith([probe]).serialize(doc(align))).toBe('probe align="center"\n');
	});
});

describe("syntax extensions: reading", () => {
	/** A made-up notation: `@@word@@` becomes a `Mark` element. The plugin is a function of the site's blocks. */
	const atNotation = (blockNames: string[]): SyntaxExtension => ({
		name: "at",
		remarkPlugins: (context) => {
			blockNames.push(...context.blocks.list.map((block) => block.name));
			return [
				() => (tree: Root) => {
					visit(tree, "text", (node, index, parent) => {
						const match = /@@(\w+)@@/.exec(node.value);
						if (!match || index == null || !parent) return;
						parent.children.splice(index, 1, {
							type: "mdxJsxTextElement",
							name: "u",
							attributes: [],
							children: [{ type: "text", value: match[1] ?? "" }],
						} as never);
					});
				},
			];
		},
	});

	it("an extension's plugins read its notation, and receive the site's blocks", () => {
		const names: string[] = [];
		const { write } = mdxWith([atNotation(names)]);
		expect(write("앞 @@word@@ 뒤").trimEnd()).toBe("<u>word</u>");
		expect(names).toContain("image");
	});

	it("receives the names of the code block line effects the site uses", () => {
		let effects: ReadonlySet<string> = new Set();
		const spy: SyntaxExtension = {
			name: "spy",
			remarkPlugins: (context) => {
				effects = context.codeLineEffects;
				return [];
			},
		};
		mdxWith([spy]).write("text");
		expect([...effects]).toEqual(expect.arrayContaining(["highlight", "plus", "minus", "warning", "error"]));
	});

	it("without the extension the notation is ordinary text", () => {
		expect(mdxWith([]).write("앞 @@word@@ 뒤").trimEnd()).toBe("앞 @@word@@ 뒤");
	});

	it("the public render chain reads the notation too", async () => {
		const names: string[] = [];
		const markup = renderToStaticMarkup((await renderMdx("앞 @@word@@ 뒤", { syntax: [atNotation(names)] })).content);
		expect(markup).toContain("<u>word</u>");
		expect(renderToStaticMarkup((await renderMdx("앞 @@word@@ 뒤")).content)).toContain("@@word@@");
	});
});
