/**
 * Two-stage remark directive plugins.
 *
 * 1. {@link remarkDemoteUnknownDirectives} — turns **unregistered** names back into body text, exactly as written.
 *    A pipeline that does not handle directives outputs nothing (silent loss), so without turning them back,
 *    prose like `openai/gpt-oss-120b:free를` disappears. Measured on the 49 legacy posts, there are 2 false positives (`:free를`, `:1로`).
 * 2. {@link remarkDirectivesToMdx} — turns **registered** names into MDX elements. Components attach only by name
 *    (`MDX_COMPONENTS`), so they must be converted to `mdxJsxFlowElement` and `mdxJsxTextElement`.
 *    This works the same way as `remark-fence-blocks.ts`, which turns code fence blocks into MDX elements.
 *
 * The two plugins have an order. Run demote first to clear unregistered names, then convert.
 * **Both the CMS parser (`parseMdxAst`) and the public render chain use them.** The stored string does not change and only the tree the analyzer sees
 * takes the same shape as the public chain — reference collection and attribute validation **look up nodes by name**,
 * so splitting into two shapes leads to fixing only one of them.
 */

import type { Paragraph, Root, RootContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { DIRECTIVE_BY_NAME, type DirectiveDefinition } from "./directives";

/** The three node types that remark-directive creates. */
const DIRECTIVE_TYPES = ["containerDirective", "leafDirective", "textDirective"] as const;

type DirectiveNode = {
	type: (typeof DIRECTIVE_TYPES)[number];
	name: string;
	attributes?: Record<string, string | null> | null;
	children?: unknown[];
	position?: {
		start?: { offset?: number; column?: number };
		end?: { offset?: number };
	};
};

const asDirective = (node: unknown): DirectiveNode => node as DirectiveNode;

/**
 * Cuts out the **original source string** that the node occupies, as is.
 *
 * Directive strings are not reassembled from the AST — escapes, whitespace and quotes would be altered.
 */
const originalSource = (node: DirectiveNode, source: string): string => {
	const start = node.position?.start?.offset;
	const end = node.position?.end?.offset;
	if (typeof start !== "number" || typeof end !== "number") {
		// If the source cannot be preserved, stopping is better than losing it silently (analyze reports it as an error).
		throw new Error(`Can't preserve the body: the position of directive :${node.name} is unknown`);
	}
	return source.slice(start, end);
};

/**
 * Source of a block directive. From the second line on, the prefix added by the outer block (quote `> ` and list indentation) is stripped up to the column where the directive started.
 * If left as is, rewriting the outer block adds the prefix once more, and it piles up on every save (`> > `).
 */
const blockSource = (node: DirectiveNode, source: string): string => {
	const original = originalSource(node, source);
	const width = (node.position?.start?.column ?? 1) - 1;
	if (width <= 0) return original;
	return original
		.split("\n")
		.map((line, index) => (index > 0 && /^[ \t>]*$/.test(line.slice(0, width)) ? line.slice(width) : line))
		.join("\n");
};

/**
 * Marker put on the paragraph of a turned-back block directive (`paragraph.data`). On the public render it is just a text paragraph, but the write path
 * (`toDocument`) moves this paragraph into a raw block (`html`) and writes it as is without escaping. The source was not read as Markdown text,
 * so escaping it like text would not be undone on re-read, and backslashes grow on every save (`\{` → `\\\{`).
 */
export const DEMOTED_DIRECTIVE_SOURCE = "cmsDemotedDirectiveSource";

/**
 * Turns unregistered directives back into body text.
 *
 * - text directive → `text` (it is inside a sentence, so the context is the same)
 * - leaf and container directives → `paragraph(text)` (block context). Attaches {@link DEMOTED_DIRECTIVE_SOURCE} so the write path writes the source as is.
 * - An unregistered parent **keeps the whole subtree as source** and stops traversing children (converting the inside would break the contract).
 */
export const remarkDemoteUnknownDirectives =
	() =>
	(tree: Root, file: VFile): undefined => {
		const source = typeof file?.value === "string" ? file.value : "";

		visit(tree, [...DIRECTIVE_TYPES], (node, index, parent) => {
			const directive = asDirective(node);
			if (DIRECTIVE_BY_NAME.has(directive.name)) return;
			if (!parent || index == null) return;

			const replacement: RootContent =
				directive.type === "textDirective"
					? { type: "text", value: originalSource(directive, source) }
					: {
							type: "paragraph",
							// This is not a name in the mdast paragraph data type, so the type is widened. The public render (mdast → hast) ignores unknown data.
							data: { [DEMOTED_DIRECTIVE_SOURCE]: true } as Paragraph["data"],
							children: [{ type: "text", value: blockSource(directive, source) }],
						};

			(parent.children as RootContent[]).splice(index, 1, replacement);
			return [SKIP, index];
		});
	};

/**
 * Turns directive attributes into MDX attributes.
 *
 * For booleans, **the attribute is not written at all when false.** This avoids creating a `={false}` expression
 * and the trap where `"false"` is truthy — `decorative="false"` and omission mean the same.
 */
const toMdxAttributes = (
	definition: DirectiveDefinition,
	raw: Record<string, string | null> | null | undefined,
): { type: "mdxJsxAttribute"; name: string; value: string | null }[] => {
	const attributes: { type: "mdxJsxAttribute"; name: string; value: string | null }[] = [];

	for (const [name, value] of Object.entries(raw ?? {})) {
		const kind = definition.attributes[name];
		if (kind === "boolean") {
			if (value !== null && value.toLowerCase() === "false") continue;
			attributes.push({ type: "mdxJsxAttribute", name, value: null });
			continue;
		}
		// Attributes not in the definition are not dropped either (no silent loss). Whether they are allowed is handled by the pre-publish check.
		attributes.push({ type: "mdxJsxAttribute", name, value: value ?? null });
	}

	return attributes;
};

/**
 * Turns registered directives into MDX elements.
 *
 * `u`, `sup`, `sub` and `br` map to lowercase intrinsic elements, and the rest map to component names registered in `MDX_COMPONENTS`.
 */
export const remarkDirectivesToMdx =
	() =>
	(tree: Root): undefined => {
		visit(tree, [...DIRECTIVE_TYPES], (node, index, parent) => {
			const directive = asDirective(node);
			const definition = DIRECTIVE_BY_NAME.get(directive.name);
			// Unregistered names were already cleared by demote. Kept defensively.
			if (!definition) return;
			if (!parent || index == null) return;

			const attributes = toMdxAttributes(definition, directive.attributes);
			// Pass the label/body children as is. A container is block context and text is inline context, so the types differ, but
			// here the nodes made by remark-directive are moved as they are, so they are passed without narrowing.
			const children = directive.children ?? [];
			const replacement = {
				// Copy the position. If lost, image warnings and media reference positions are always reported as 1:1.
				...(directive.position ? { position: directive.position } : {}),
				type: directive.type === "textDirective" ? "mdxJsxTextElement" : "mdxJsxFlowElement",
				name: definition.component,
				attributes,
				children,
			} as unknown as RootContent;

			(parent.children as RootContent[]).splice(index, 1, replacement);
			// Children of a registered container are also traversed (merged tables inside callouts etc.). Unregistered directives are skipped (SKIP) at the demote stage.
			return definition.kind === "container" ? index : [SKIP, index];
		});
	};
