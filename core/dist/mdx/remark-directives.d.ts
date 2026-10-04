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
import type { Root } from "mdast";
import type { VFile } from "vfile";
/**
 * Marker put on the paragraph of a turned-back block directive (`paragraph.data`). On the public render it is just a text paragraph, but the write path
 * (`toDocument`) moves this paragraph into a raw block (`html`) and writes it as is without escaping. The source was not read as Markdown text,
 * so escaping it like text would not be undone on re-read, and backslashes grow on every save (`\{` → `\\\{`).
 */
export declare const DEMOTED_DIRECTIVE_SOURCE = "cmsDemotedDirectiveSource";
/**
 * Turns unregistered directives back into body text.
 *
 * - text directive → `text` (it is inside a sentence, so the context is the same)
 * - leaf and container directives → `paragraph(text)` (block context). Attaches {@link DEMOTED_DIRECTIVE_SOURCE} so the write path writes the source as is.
 * - An unregistered parent **keeps the whole subtree as source** and stops traversing children (converting the inside would break the contract).
 */
export declare const remarkDemoteUnknownDirectives: () => (tree: Root, file: VFile) => undefined;
/**
 * Turns registered directives into MDX elements.
 *
 * `u`, `sup`, `sub` and `br` map to lowercase intrinsic elements, and the rest map to component names registered in `MDX_COMPONENTS`.
 */
export declare const remarkDirectivesToMdx: () => (tree: Root) => undefined;
