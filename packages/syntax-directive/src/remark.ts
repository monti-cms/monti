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
 * **Both the CMS parser (`parseMdxAst`) and the public render chain use them** (through the extension's `remarkPlugins`). The stored string does not change and only the tree the analyzer sees
 * takes the same shape as the public chain — reference collection and attribute validation **look up nodes by name**,
 * so splitting into two shapes leads to fixing only one of them.
 */

import { RAW_SOURCE_PARAGRAPH, type SyntaxBlocks } from "@monti-cms/core/syntax";
import type { Paragraph, Root, RootContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";

export type DirectiveKind = "container" | "leaf" | "text";

/** A block that has a directive spelling, reduced to what reading a directive needs. */
export type DirectiveDefinition = {
	/** Name in the directive syntax (lowercase kebab-case). */
	name: string;
	kind: DirectiveKind;
	/** Element/component name used for rendering. Lowercase names are MDX intrinsic elements. */
	component: string;
	attributes: Record<string, "string" | "boolean">;
};

export type DirectiveDefinitions = ReadonlyMap<string, DirectiveDefinition>;

/** Directive definitions of the blocks the site uses (container, leaf and text blocks; fences and math have their own Markdown syntax). */
export const directiveDefinitions = (blocks: SyntaxBlocks): DirectiveDefinitions =>
	new Map(
		blocks.list.flatMap((block) => {
			const { syntax } = block;
			if (syntax.kind !== "container" && syntax.kind !== "leaf" && syntax.kind !== "text") return [];
			const definition: DirectiveDefinition = {
				name: syntax.directive,
				kind: syntax.kind,
				component: block.component,
				attributes: Object.fromEntries(
					Object.entries(block.attributes).map(([name, attribute]) => [name, attribute.type]),
				),
			};
			return [[syntax.directive, definition] as const];
		}),
	);

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
 * Turns unregistered directives back into body text.
 *
 * - text directive → `text` (it is inside a sentence, so the context is the same)
 * - leaf and container directives → `paragraph(text)` (block context). Attaches {@link RAW_SOURCE_PARAGRAPH} so the write path writes the source as is (the source was not read as Markdown text, so escaping it like text would not be undone on re-read).
 * - An unregistered parent **keeps the whole subtree as source** and stops traversing children (converting the inside would break the contract).
 */
export const remarkDemoteUnknownDirectives =
	(definitions: DirectiveDefinitions) =>
	(tree: Root, file: VFile): undefined => {
		const source = typeof file?.value === "string" ? file.value : "";

		visit(tree, [...DIRECTIVE_TYPES], (node, index, parent) => {
			const directive = asDirective(node);
			if (definitions.has(directive.name)) return;
			if (!parent || index == null) return;

			const replacement: RootContent =
				directive.type === "textDirective"
					? { type: "text", value: originalSource(directive, source) }
					: {
							type: "paragraph",
							// This is not a name in the mdast paragraph data type, so the type is widened. The public render (mdast → hast) ignores unknown data.
							data: { [RAW_SOURCE_PARAGRAPH]: true } as Paragraph["data"],
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
	(definitions: DirectiveDefinitions) =>
	(tree: Root): undefined => {
		visit(tree, [...DIRECTIVE_TYPES], (node, index, parent) => {
			const directive = asDirective(node);
			const definition = definitions.get(directive.name);
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
