import type { BlockDefinition } from "../blocks/define.js";
import type { StoredDocument } from "../doc/stored-document.js";
import type { CmsNode } from "../doc/types.js";
/**
 * The allowed blocks and marks of a body. One list in the schema (`body` of a collection) read by the editor (toolbar, slash menu, insert menu, input
 * rules, paste) and by validation, so they cannot disagree. A body field without a list allows everything.
 *
 * The list only limits what a writer can **add**. A body that already holds a block or mark that is not allowed keeps it: the editor opens it, shows it
 * and saves it unchanged. Validation reports what the list does not allow as a warning on every save and publish, and never rejects a write: the editor
 * (menus, input rules, paste) is what keeps new content inside the list.
 */
/** The heading levels a body can hold. */
export declare const HEADING_LEVELS: readonly [1, 2, 3, 4, 5, 6];
export type HeadingLevel = (typeof HEADING_LEVELS)[number];
/** What a body of a collection allows. A key that is left out allows everything of its kind. */
export interface BodyAllowed {
    /**
     * Allowed blocks. Core blocks by the names in {@link CORE_BODY_BLOCKS}, and blocks added by block extensions or the site config by block name
     * (`callout`, `tabs`, ...). Paragraphs, lists and line breaks are always allowed.
     */
    readonly blocks?: readonly string[];
    /** Allowed marks: the names in {@link CORE_BODY_MARKS} and text styles added by block extensions or the site config by block name (`tooltip`, `color`, ...). */
    readonly marks?: readonly string[];
    /** Allowed heading levels. The editor offers levels 2 to 4 (the page title is the level 1 heading); other levels are only checked in stored content. */
    readonly headings?: readonly HeadingLevel[];
}
/**
 * Names of the core blocks a body list can hold. `table`, `math`, `image`, `file` and `text-align` are also the names of their block definitions; the rest
 * are built into the document model. Footnotes cover the reference and the definition.
 */
export declare const CORE_BODY_BLOCKS: readonly ["table", "taskList", "math", "image", "file", "codeBlock", "blockquote", "horizontalRule", "footnotes", "text-align"];
/** Names of the core marks a body list can hold, as they are stored. */
export declare const CORE_BODY_MARKS: readonly ["bold", "italic", "strike", "underline", "code", "link", "superscript", "subscript"];
/** What a site can name in a body list: the core names, and the blocks and text styles its plugins and config add. */
export interface BodyVocabulary {
    readonly blocks: readonly string[];
    readonly marks: readonly string[];
}
/** The part of a site the body rules read. */
export interface BodyRulesSite {
    readonly BLOCKS: readonly BlockDefinition[];
    readonly ADDED_BLOCKS: readonly BlockDefinition[];
    readonly BLOCK_BY_NAME: ReadonlyMap<string, BlockDefinition>;
}
/** The names a body list of this site can hold. */
export declare function bodyVocabulary(site: BodyRulesSite): BodyVocabulary;
/**
 * Checks the body list of a collection against what the site can name. A name that is not a block or mark of the site is an error, so a typo does not
 * silently leave a block allowed (or disallowed).
 */
export declare function validateBodyAllowed(collection: string, allowed: BodyAllowed | undefined, site: BodyRulesSite): void;
/** What a body allows, as questions. Built by {@link bodyRules}. */
export interface BodyRules {
    /** Whether the body has any list. A body without one allows everything. */
    readonly limited: boolean;
    /** Whether a block (a name of {@link bodyVocabulary}) is allowed. */
    allowsBlock(name: string): boolean;
    /** Whether a mark (a stored mark name) is allowed. */
    allowsMark(name: string): boolean;
    /** Whether a heading level is allowed. */
    allowsHeading(level: number): boolean;
}
/** The rules of a body list. `undefined` (no list) allows everything. */
export declare function bodyRules(allowed: BodyAllowed | undefined): BodyRules;
/** A block or mark of a body that its list does not allow. */
export interface DisallowedItem {
    readonly kind: "block" | "mark";
    /** The name in the body list (`callout`, `table`, `bold`), or `heading` for a heading level that is not allowed. */
    readonly name: string;
    /** The level of a heading that is not allowed. */
    readonly level?: number;
    /** The block it is in (the block itself for a block, the block that holds the text for a mark). */
    readonly blockId?: string;
}
/**
 * The name a stored node has in a body list, or `undefined` for what a list does not govern (paragraphs, lists, line breaks, the rows and cells of a table, the
 * children of a container, JSX no definition describes).
 */
export declare function listedBlockName(site: Pick<BodyRulesSite, "BLOCK_BY_NAME" | "BLOCKS">, node: CmsNode): string | undefined;
/**
 * Every block and mark of a stored document that its list does not allow, in document order: one item per block, and one per mark in each block that holds
 * text with it. Reads the stored document only, so it gives the same answer whichever notation or API the body came from.
 */
export declare function disallowedInDocument(site: Pick<BodyRulesSite, "BLOCK_BY_NAME" | "BLOCKS">, allowed: BodyAllowed | undefined, doc: StoredDocument | readonly CmsNode[]): DisallowedItem[];
