// Set the dictionary language first so labels (`block.label`) know the UI language.
import "../i18n/index.js";
import { cmsConfig } from "../config/resolved.js";
import { addedBlocks, resolveBlocks } from "./resolve.js";
/** Body blocks the site uses (core blocks plus blocks added by plugins and site config). Read by the storage syntax table, validation, the editor, and `/meta`. */
export const BLOCKS = resolveBlocks(cmsConfig);
const ACTIVE = new Set(BLOCKS.map((block) => block.name));
/** Whether this block is used (installed). */
export const isBlockActive = (name) => ACTIVE.has(name);
/** Added blocks (block extension plugins and the site config's `blocks`). The editor builds nodes from these definitions. */
export const ADDED_BLOCKS = addedBlocks(cmsConfig).map(({ block }) => block);
/** Added text marks (`syntax.kind: "text"`, `editor.view: "mark"`). Add order is the order overlapping marks are stored. */
export const ADDED_MARK_BLOCKS = ADDED_BLOCKS.filter((block) => block.syntax.kind === "text");
