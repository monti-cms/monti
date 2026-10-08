import { textAlign } from "./definitions.js";
/**
 * Rules that read one block definition, shared by the server, editor, and public renderer. The tables built from the blocks a site uses (`BLOCK_BY_NAME`,
 * `FENCE_BLOCKS`, `childRules`, ...) belong to its `Site` (see `active.ts`).
 */
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
const optionValues = (block, attribute) => Object.keys(block.attributes[attribute]?.options ?? {});
/** Allowed alignment values. `justify` is not used. */
export const TEXT_ALIGN_VALUES = optionValues(textAlign, "align");
