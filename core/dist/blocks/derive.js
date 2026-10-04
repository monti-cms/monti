import { ADDED_BLOCKS, BLOCKS } from "./active.js";
import { textAlign } from "./definitions.js";
/**
 * Builds the storage syntax table, validation rules, and constants from the block definitions the site uses. Shared by the server, editor, and public renderer.
 */
export const BLOCK_BY_NAME = new Map(BLOCKS.map((block) => [block.name, block]));
/** Public renderer name (JSX name) → block definition. */
export const BLOCK_BY_COMPONENT = new Map(BLOCKS.map((block) => [block.component, block]));
/** Directive-syntax blocks (`:::`, `::`, `:`). Code fences and math use Markdown syntax, so they are not in the directive table. */
export const directiveBlocks = () => BLOCKS.filter((block) => block.syntax.kind === "container" || block.syntax.kind === "leaf" || block.syntax.kind === "text");
/** Added code fence blocks. Fence language → block definition. */
export const FENCE_BLOCKS = new Map(ADDED_BLOCKS.flatMap((block) => (block.syntax.kind === "fence" ? [[block.syntax.lang, block]] : [])));
/** The added block for a code fence language. Case-insensitive. */
export const fenceBlockOf = (lang) => typeof lang === "string" ? FENCE_BLOCKS.get(lang.toLowerCase()) : undefined;
/** The attribute name when a value falls outside an attribute's allowed choices. The pre-publish check reports it as `invalid_block_attribute`. */
export function invalidOptionAttributes(block, attributes) {
    const invalid = [];
    for (const [name, attribute] of Object.entries(block.attributes)) {
        const value = attributes[name];
        if (!attribute.options || typeof value !== "string" || value === "")
            continue;
        if (!Object.hasOwn(attribute.options, value))
            invalid.push(name);
    }
    return invalid;
}
/** Blocks with child block rules (name, count) and their children's renderer names. The storage check counts them. */
export const childRules = () => ADDED_BLOCKS.flatMap((block) => {
    const names = block.children?.blocks ?? [];
    if (names.length === 0)
        return [];
    const childComponents = names.flatMap((name) => BLOCK_BY_NAME.get(name)?.component ?? []);
    return [{ block, childComponents }];
});
const optionValues = (block, attribute) => Object.keys(block.attributes[attribute]?.options ?? {});
/** Allowed alignment values. `justify` is not used. */
export const TEXT_ALIGN_VALUES = optionValues(textAlign, "align");
