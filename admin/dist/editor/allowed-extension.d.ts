import { type AnyExtension } from "@tiptap/core";
import { Fragment, type Schema, Slice } from "@tiptap/pm/model";
import { type EditorState, PluginKey } from "@tiptap/pm/state";
import { type EditorAllowance } from "./allowed.js";
/**
 * How the editor keeps to the allowed list of a body (`allowed.ts`). Four parts, all reading the same {@link EditorAllowance}:
 *
 * 1. {@link restrictExtensions} takes the input rules, paste rules and keyboard shortcuts away from every node and mark the list does not allow, so
 *    typing `> ` or pressing a shortcut does not add one. The nodes and marks stay in the schema, so a body that holds them still opens.
 * 2. The guard plugin refuses a change that **introduces** a disallowed type the editor's document does not hold yet (a command, a drop, anything that got
 *    past the parts above). A type already in the document can still be edited, moved, duplicated and deleted. Undo and redo are never refused.
 * 3. Paste is cleaned before it is inserted ({@link cleanSlice}): a block that is not allowed becomes its text in paragraphs, a mark that is not allowed
 *    is dropped from the text. The text is kept; only the form changes. A paste never brings in a disallowed block, even one the document already holds.
 * 4. The toolbar, the slash menu and the insert menus read the same allowance and do not list what is not allowed (`tiptap-editor.tsx`).
 */
/** The allowance an editor was built with: `editor.state` carries it so tools that only get the state can read it. */
export declare const allowedKey: PluginKey<EditorAllowance>;
/** The allowance of an editor state (everything allowed when the editor has none). */
export declare const allowanceOfState: (state: EditorState) => EditorAllowance;
/** Set on a transaction that replaces the whole body with stored content (opening an entry, applying a template): what is stored is never refused. */
export declare const ALLOWED_BYPASS_META = "cmsAllowedBypass";
/**
 * The extensions with the input rules, paste rules and shortcuts of what the list does not allow taken away. The list a site's StarterKit brings is
 * restricted inside it. With no limit the same extensions come back, so an editor without a list is exactly what it was.
 */
export declare function restrictExtensions(extensions: readonly AnyExtension[], allowance: EditorAllowance): AnyExtension[];
/**
 * A pasted fragment in the form the list allows. A block that is not allowed is not inserted; its text is: a text block becomes a paragraph, a container
 * gives its children (a table, quote or callout becomes the paragraphs inside it), and a block with only an attribute for content says it in words (a
 * formula its source, an image its description) or leaves nothing. A mark that is not allowed is dropped from the text. Nothing else changes.
 */
export declare function cleanFragment(fragment: Fragment, allowance: EditorAllowance, schema: Schema): Fragment;
/** A pasted slice in the form the list allows (see {@link cleanFragment}). The same slice when it holds nothing the list refuses. */
export declare function cleanSlice(slice: Slice, allowance: EditorAllowance, schema: Schema): Slice;
/**
 * The extension that holds the allowance: it keeps it in the editor state, refuses a change that introduces a disallowed type, and cleans what is pasted.
 * Without a limit it is not added.
 */
export declare const cmsAllowedGuard: (allowance: EditorAllowance) => AnyExtension;
