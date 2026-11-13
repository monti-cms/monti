import { type Block, type Doc, type Inline, type Mark, newBlockId, readFence } from "@monti-cms/core";
import type { Nodes, PhrasingContent, RootContent } from "mdast";
import { directiveFromMarkdown } from "mdast-util-directive";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { directive } from "micromark-extension-directive";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import { parse as parseYaml } from "yaml";
import { KEPT, KEPT_HTML } from "./kept";

/** What a block type of the site holds, for a `:::directive` that names it: its words, other blocks, or nothing. */
export type KnownBlocks = (type: string) => "text" | "blocks" | "nothing" | null;

export type ReadFile = {
	/** The front matter, as loose values. */
	values: Record<string, unknown>;
	doc: Doc;
	/** Components no block is known for, by name: each is kept as written. */
	unknown: string[];
};

const coerce = (value: string | null | undefined): unknown => {
	if (value == null || value === "") return true;
	if (value === "true") return true;
	if (value === "false") return false;
	return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
};

/**
 * Reads a `.md` or `.mdx` file into a body (doc 14, the MDX plugin): its front matter as values, its text as blocks. A `:::name{…}` directive
 * that names one of the site's blocks becomes that block; a component (`<Tweet />`), or a directive no block is known for, is kept as
 * written in a code block and named in `unknown`. A fenced code block keeps its text as it is, notations in its lines included.
 */
export function readMarkdown(text: string, options: { mdx?: boolean; known?: KnownBlocks } = {}): ReadFile {
	const known = options.known ?? (() => null);
	const tree = fromMarkdown(text, {
		extensions: [frontmatter(["yaml"]), gfm(), directive()],
		mdastExtensions: [frontmatterFromMarkdown(["yaml"]), gfmFromMarkdown(), directiveFromMarkdown()],
	});
	const source = (node: Nodes) => text.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0);
	const unknown: string[] = [];
	let values: Record<string, unknown> = {};
	/** The addresses the file defines apart from where it uses them (`[docs]: https://…`), by their name. */
	const defined = new Map<string, { url: string; title?: string | null }>();
	const collect = (nodes: readonly Nodes[]) => {
		for (const node of nodes) {
			if (node.type === "definition") defined.set(node.identifier, { url: node.url, title: node.title });
			if ("children" in node) collect(node.children as Nodes[]);
		}
	};
	collect(tree.children);
	/** A link's address when a body may hold it: a script address is not one, and its words stay as plain text. */
	// Read as a browser reads it: spaces, tabs and line ends anywhere in the address are not part of it.
	// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what is taken out.
	const safe = (url: string) => !/^(javascript|vbscript|data):/i.test(url.replace(/[\u0000-\u0020]/g, ""));
	const linked = (children: readonly PhrasingContent[], url: string | undefined, marks: Mark[]) =>
		inline(children, url !== undefined && safe(url) ? [...marks, { type: "link", href: url }] : marks);
	/** The picture a paragraph is, when it holds nothing else: written in place, or by the name of a defined address. */
	const pictureOf = (node: PhrasingContent | undefined) => {
		if (node?.type === "image") return { url: node.url, alt: node.alt, title: node.title };
		const found = node?.type === "imageReference" ? defined.get(node.identifier) : undefined;
		return found && node?.type === "imageReference" ? { url: found.url, alt: node.alt, title: found.title } : null;
	};

	/** The inline content of a paragraph, a heading, a cell: marks carried down, raw tags the body has a mark for turned into it. */
	const inline = (nodes: readonly PhrasingContent[], marks: Mark[] = []): Inline[] => {
		const out: Inline[] = [];
		const push = (value: string, own: Mark[] = marks) => {
			if (value === "") return;
			const last = out.at(-1);
			if (last?.type === "text" && JSON.stringify(last.marks ?? []) === JSON.stringify(own)) last.text += value;
			else out.push({ type: "text", text: value, ...(own.length > 0 ? { marks: own } : {}) });
		};
		const TAGS: Record<string, string> = { u: "underline", sup: "sup", sub: "sub" };
		let open: Mark[] = [];
		for (const node of nodes) {
			const now = [...marks, ...open];
			switch (node.type) {
				case "text":
					push(node.value, now);
					break;
				case "strong":
					out.push(...inline(node.children, [...now, { type: "bold" }]));
					break;
				case "emphasis":
					out.push(...inline(node.children, [...now, { type: "italic" }]));
					break;
				case "delete":
					out.push(...inline(node.children, [...now, { type: "strike" }]));
					break;
				case "inlineCode":
					push(node.value, [...now, { type: "code" }]);
					break;
				case "link":
					out.push(...linked(node.children, node.url, now));
					break;
				case "linkReference":
					// A link by the name of an address the file defines; with no such address its words stay.
					out.push(...linked(node.children, defined.get(node.identifier)?.url, now));
					break;
				case "imageReference":
					push(node.alt ?? "", now);
					break;
				case "break":
					out.push({ type: "hardBreak" });
					break;
				case "footnoteReference":
					out.push({ type: "footnoteRef", id: node.identifier });
					break;
				case "image":
					push(node.alt ?? "", now);
					break;
				case "html": {
					// A code link (doc 17): `<CodeRef to="c1">words</CodeRef>`, the label of lines in a code block of this body.
					const codeRef = /^<CodeRef\s+to=(?:"([^"]*)"|'([^']*)')\s*>$/.exec(node.value.trim());
					if (codeRef) {
						open = [...open, { type: "codeRef", block: "", anchor: codeRef[1] ?? codeRef[2] ?? "" }];
						break;
					}
					if (node.value.trim() === "</CodeRef>") {
						open = open.filter((each) => each.type !== "codeRef");
						break;
					}
					const tag = /^<(\/)?([a-z]+)\s*\/?>$/i.exec(node.value.trim());
					const mark = tag ? TAGS[(tag[2] ?? "").toLowerCase()] : undefined;
					if (tag && (tag[2] ?? "").toLowerCase() === "br") out.push({ type: "hardBreak" });
					else if (mark && !tag?.[1]) open = [...open, { type: mark }];
					else if (mark) open = open.filter((each) => each.type !== mark);
					else push(node.value, now);
					break;
				}
				case "textDirective":
					// The old code link, `:code-ref[words]{to="c1"}`.
					if (node.name === "code-ref" && typeof node.attributes?.to === "string") {
						out.push(...inline(node.children, [...now, { type: "codeRef", block: "", anchor: node.attributes.to }]));
						break;
					}
					push(source(node), now);
					break;
				default:
					// What has no inline of its own (a text directive, a reference) stays as it was written.
					push(source(node), now);
			}
		}
		return out;
	};

	const textBlock = (type: string, content: Inline[], attrs?: Record<string, unknown>): Block => ({
		id: newBlockId(),
		type,
		...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
		...(content.length > 0 ? { content } : {}),
	});
	const kept = (node: Nodes, language: string): Block =>
		textBlock("codeBlock", [{ type: "text", text: source(node) }], { language });

	const blocks = (nodes: readonly RootContent[]): Block[] =>
		nodes.flatMap((node): Block[] => {
			switch (node.type) {
				case "yaml": {
					try {
						const parsed = parseYaml(node.value);
						if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
							values = parsed as Record<string, unknown>;
					} catch {}
					return [];
				}
				case "heading":
					return [textBlock("heading", inline(node.children), { level: Math.min(4, Math.max(2, node.depth)) })];
				case "paragraph": {
					// A picture on a line of its own is a picture block: named by the address the file gives it.
					const only = node.children.length === 1 ? pictureOf(node.children[0]) : null;
					if (only)
						return [
							{
								id: newBlockId(),
								type: "image",
								attrs: {
									src: only.url,
									...(only.alt ? { alt: only.alt } : {}),
									...(only.title ? { caption: only.title } : {}),
								},
							},
						];
					// An `.mdx` file's own lines of code (`import X from "…"`) are not the entry's words.
					if (options.mdx && /^(import|export)\s/.test(source(node))) return [];
					const content = inline(node.children);
					return content.length > 0 ? [textBlock("paragraph", content)] : [];
				}
				case "list": {
					const checks = node.children.some((item) => typeof item.checked === "boolean");
					// An item is its first line of words; items inside it follow it, one list (the body has no list in a list).
					const items = (list: typeof node): Block[] =>
						list.children.flatMap((item): Block[] => {
							const [first, ...rest] = item.children;
							const words = first?.type === "paragraph" ? inline(first.children) : [];
							const inner = (first?.type === "paragraph" ? rest : item.children).flatMap((child) =>
								child.type === "list"
									? items(child)
									: child.type === "paragraph"
										? [textBlock("listItem", inline(child.children))]
										: [],
							);
							return [textBlock("listItem", words, checks ? { checked: item.checked === true } : undefined), ...inner];
						});
					return [
						{
							id: newBlockId(),
							type: checks ? "checklist" : node.ordered ? "orderedList" : "bulletList",
							...(node.ordered && !checks && typeof node.start === "number" && node.start !== 1
								? { attrs: { start: node.start } }
								: {}),
							children: items(node),
						},
					];
				}
				case "blockquote":
					return [{ id: newBlockId(), type: "quote", children: blocks(node.children) }];
				case "code": {
					// Shiki's notation and the old Monti comments become the block's effects; the rest of the fence line is kept (doc 17, T79).
					const fence = readFence({ lang: node.lang, meta: node.meta, value: node.value });
					return [textBlock("codeBlock", fence.content, fence.attrs)];
				}
				case "table": {
					const cell = (nodes: readonly PhrasingContent[]) =>
						inline(nodes)
							.map((each) => (each.type === "text" ? each.text : each.type === "hardBreak" ? " " : ""))
							.join("");
					return [
						{
							id: newBlockId(),
							type: "table",
							attrs: {
								header: true,
								rows: node.children.map((row) => row.children.map((each) => cell(each.children))),
							},
						},
					];
				}
				case "thematicBreak":
					return [{ id: newBlockId(), type: "divider" }];
				case "footnoteDefinition": {
					const [first] = node.children;
					return [
						textBlock("footnote", first?.type === "paragraph" ? inline(first.children) : [], { id: node.identifier }),
					];
				}
				case "html": {
					const name = /^<([A-Z][\w.]*)/.exec(node.value.trim())?.[1];
					if (name) unknown.push(name);
					// A comment says nothing to a reader.
					if (/^<!--[\s\S]*-->$/.test(node.value.trim())) return [];
					return [kept(node, name ? KEPT : KEPT_HTML)];
				}
				case "containerDirective":
				case "leafDirective": {
					const holds = known(node.name);
					if (holds === null) {
						unknown.push(node.name);
						return [kept(node, KEPT)];
					}
					const attrs = Object.fromEntries(
						Object.entries(node.attributes ?? {}).map(([key, value]) => [key, coerce(value)]),
					);
					const children = node.type === "containerDirective" ? node.children : [];
					const [first] = children;
					return [
						{
							id: newBlockId(),
							type: node.name,
							...(Object.keys(attrs).length > 0 ? { attrs } : {}),
							...(holds === "blocks" ? { children: blocks(children) } : {}),
							...(holds === "text" && first?.type === "paragraph" ? { content: inline(first.children) } : {}),
						},
					];
				}
				case "definition":
					return [];
				default:
					return [kept(node, KEPT)];
			}
		});

	const made = blocks(tree.children);
	return { values, doc: { type: "doc", blocks: pointCodeLinks(made) }, unknown };
}

/**
 * A code link names a label; the file has no block ids, so it goes to the first code block with that label (the old `:code-ref`'s rule). One whose
 * label no code block has stays, broken (`-`): the publish check finds it (doc 17, 17-8).
 */
function pointCodeLinks(blocks: Block[]): Block[] {
	const owner = new Map<string, string>();
	const visit = (list: Block[]) => {
		for (const block of list) {
			if (block.type === "codeBlock")
				for (const effect of (block.attrs?.lines ?? []) as { name: string; attrs?: { id?: string } }[])
					if (effect.name === "anchor" && effect.attrs?.id && !owner.has(effect.attrs.id))
						owner.set(effect.attrs.id, block.id);
			if (block.children) visit(block.children);
		}
	};
	visit(blocks);
	const point = (block: Block): Block => ({
		...block,
		...(block.content
			? {
					content: block.content.map((part) =>
						part.type === "text" && part.marks?.some((mark) => mark.type === "codeRef" && mark.block === "")
							? {
									...part,
									marks: part.marks.map((mark) =>
										mark.type === "codeRef" && mark.block === ""
											? { ...mark, block: owner.get(String(mark.anchor)) ?? "-" }
											: mark,
									),
								}
							: part,
					),
				}
			: {}),
		...(block.children ? { children: block.children.map(point) } : {}),
	});
	return blocks.map(point);
}
