import "../i18n/index.js";
import type { BlockDefinition } from "./define.js";
/** Body blocks the site uses (core blocks plus blocks added by plugins and site config). Read by the storage syntax table, validation, the editor, and `/meta`. */
export declare const BLOCKS: readonly BlockDefinition[];
/** Whether this block is used (installed). */
export declare const isBlockActive: (name: string) => boolean;
/** Added blocks (block extension plugins and the site config's `blocks`). The editor builds nodes from these definitions. */
export declare const ADDED_BLOCKS: readonly BlockDefinition[];
/** Added text marks (`syntax.kind: "text"`, `editor.view: "mark"`). Add order is the order overlapping marks are stored. */
export declare const ADDED_MARK_BLOCKS: readonly BlockDefinition[];
