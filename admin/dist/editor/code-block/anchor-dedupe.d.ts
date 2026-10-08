import type { Site } from "@monti-cms/core/client";
import { Plugin } from "@tiptap/pm/state";
/**
 * Keeps line labels unique in the document, so a body link points to lines of exactly one code block (the public page and the publish
 * check resolve a label to the first block that has it).
 *
 * When a change leaves a label in a second code block (a duplicated, pasted or dropped copy), the block that held it before keeps it.
 * The copy's label is renamed together with the body links that came in with the same change (a pasted section of text and code stays
 * linked to its own code), or removed when none did: the existing links keep pointing to the original lines.
 */
export declare function createAnchorDedupePlugin(site: Site): Plugin;
