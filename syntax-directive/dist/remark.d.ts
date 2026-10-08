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
import { type SyntaxBlocks } from "@monti-cms/mdx";
import type { Root } from "mdast";
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
export declare const directiveDefinitions: (blocks: SyntaxBlocks) => DirectiveDefinitions;
/**
 * Turns unregistered directives back into body text.
 *
 * - text directive → `text` (it is inside a sentence, so the context is the same)
 * - leaf and container directives → `paragraph(text)` (block context). Attaches {@link RAW_SOURCE_PARAGRAPH} so the write path writes the source as is (the source was not read as Markdown text, so escaping it like text would not be undone on re-read).
 * - An unregistered parent **keeps the whole subtree as source** and stops traversing children (converting the inside would break the contract).
 */
export declare const remarkDemoteUnknownDirectives: (definitions: DirectiveDefinitions) => (tree: Root, file: VFile) => undefined;
/**
 * Turns registered directives into MDX elements.
 *
 * `u`, `sup`, `sub` and `br` map to lowercase intrinsic elements, and the rest map to component names registered in `MDX_COMPONENTS`.
 */
export declare const remarkDirectivesToMdx: (definitions: DirectiveDefinitions) => (tree: Root) => undefined;
