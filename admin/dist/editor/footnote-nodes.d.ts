import { type Editor, Extension, Node, type Range } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
export declare const FOOTNOTE_REFERENCE_NAME = "footnoteReference";
export declare const FOOTNOTE_DEFINITION_NAME = "footnoteDefinition";
/** GFM matches labels case-insensitively, so numbering and lookups use this key. The stored label is never changed. */
export declare const footnoteKey: (label: string) => string;
/**
 * Display numbers: the order in which each label is first referenced in the document (what the public page shows too).
 * Keyed by `footnoteKey`. Definitions do not take part, so a definition nobody references has no number.
 */
export declare const footnoteNumbers: (doc: PmNode) => Map<string, number>;
/** The next numeric label: one more than the largest number already used by a reference or a definition (labels like `note` are ignored). */
export declare const nextFootnoteLabel: (doc: PmNode) => string;
/**
 * GFM footnote reference (`text[^label]`). A small superscript chip that is selected and deleted as a whole.
 * The number on the chip is the order of first reference (a decoration from `CmsFootnoteNumbers`); the stored label does not change.
 */
export declare const CmsFootnoteReference: Node<any, any>;
/**
 * GFM footnote definition (`[^label]: content`). A block with ordinary block content (paragraphs, lists, code…) that stays where it is in the source.
 */
export declare const CmsFootnoteDefinition: Node<any, any>;
/** Shows each footnote's number and flags problems (a reference without a definition, an unused or duplicate definition) as the document changes. */
export declare const CmsFootnoteNumbers: Extension<any, any>;
export declare const FOOTNOTE_EXTENSIONS: (Extension<any, any> | Node<any, any>)[];
/** Whether an inline footnote reference can go at `range.from` (default: the selection start). False in a code block, for example. */
export declare const canInsertFootnote: (editor: Editor, range?: Range) => boolean;
/**
 * Inserts a reference at the cursor (replacing `range`, the typed slash command) with the next numeric label, appends an empty definition at the end of
 * the document and moves the cursor into it. Does nothing where an inline reference cannot go (a code block, for example).
 */
export declare const insertFootnote: (editor: Editor, range?: Range) => boolean;
