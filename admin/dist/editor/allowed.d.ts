import { type BodyAllowed, type BodyRules, type Site } from "@monti-cms/core/client";
/**
 * What the editor offers for a body, from the allowed list of the collection (`body` in the schema, read the same way by validation). The editor knows
 * Tiptap node and mark names, the list knows the names stored documents use, so this is the one place that maps one to the other.
 *
 * The list only limits what a writer can add. Every node and mark stays in the editor schema, so a body that already holds something not allowed opens,
 * shows it and saves it unchanged; what is limited is the way to **add** more: the toolbar, the slash and insert menus, input rules and shortcuts, and paste
 * (`allowed-extension.ts`).
 */
export interface EditorAllowance {
    /** The collection's list limits something. */
    readonly limited: boolean;
    readonly rules: BodyRules;
    /** A block of the list by its name (`table`, `callout`, ...). A name the list does not govern is allowed. */
    allowsBlock(name: string): boolean;
    /** A mark by its stored name (`bold`, `tooltip`, ...). */
    allowsMark(name: string): boolean;
    /** A heading level. */
    allowsHeading(level: number): boolean;
    /** A Tiptap node type by its name (`taskList`, `cmsCallout`, ...). A node the list does not govern is allowed. */
    allowsNode(name: string): boolean;
    /** A Tiptap mark type by its name (`bold`, `cmsTooltip`, ...). */
    allowsEditorMark(name: string): boolean;
    /** The name a Tiptap node has in the list, if it is governed by it. */
    blockOfNode(name: string): string | undefined;
    /** The name a Tiptap mark has in the list (the stored mark name), if it is governed by it. */
    markOfEditorMark(name: string): string | undefined;
}
/** An editor with no list: everything is allowed. */
export declare const OPEN_ALLOWANCE: EditorAllowance;
/**
 * What the editor offers for a body list. The same object for the same site and list, so the extensions built from it stay the same between renders.
 * Without a list, or one that limits nothing, everything is allowed.
 */
export declare function editorAllowance(site: Site, allowed: BodyAllowed | undefined): EditorAllowance;
