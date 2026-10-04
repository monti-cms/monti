/**
 * Body block definition spec. Defines one block's storage syntax, settings attributes, child rules, editing mode, and public renderer in one place.
 *
 * Definitions are shared by the server (storage validation), the editor, the public renderer, and `/meta`, so they hold **only JSON-serializable values**.
 * Editing UI (NodeView, settings form) and public components are referenced by name only; implementations live in their own registries:
 *
 * - Public renderer: the site's MDX component table (`component` name)
 * - Editor: core blocks (image, file, math) use the admin package's `editor/block-views.ts` (`editor.nodeView` name). For added blocks,
 *   the admin package builds editor nodes from the definition, and the edit screen takes `blockViews` (whole view) or
 *   `blockEditors` (attribute and body boxes) from `CmsAdminComponentsProvider`. If neither exists, the default box is used.
 *
 * Sites add blocks through `blocks` in the config, and block extensions (e.g. `@monti-cms/blocks`) add them through a plugin's `blocks` (`blocks/resolve.ts`).
 */
/** Storage syntax. Directives are `:::name`, `::name`, `:name[...]`; code fences are ` ```lang `; math is `$$`. */
export type BlockSyntax = {
    readonly kind: "container";
    readonly directive: string;
} | {
    readonly kind: "leaf";
    readonly directive: string;
} | {
    readonly kind: "text";
    readonly directive: string;
} | {
    readonly kind: "fence";
    readonly lang: string;
} | {
    readonly kind: "math";
};
export interface BlockAttribute {
    readonly type: "string" | "boolean";
    readonly label: string;
    readonly description?: string;
    /** Blocks publishing when empty. */
    readonly required?: boolean;
    /** Selectable values → labels. If present, any other value blocks publishing. */
    readonly options?: Readonly<Record<string, string>>;
    readonly defaultValue?: string | boolean;
    /** Settings form input. If absent, the default input for the type (single line, checkbox, select). */
    readonly input?: "textarea";
    /** Translatable text (e.g. title, tab name). The translation view translates it separately as a header line. */
    readonly translatable?: boolean;
    /** The value must be one of this attribute's values across child blocks (e.g. initially open tab → tab name). Checked by the pre-publish check. */
    readonly childValue?: string;
    /**
     * The value is the line label of a code block in the same entry (the `id` of the code fence comment `anchor` line effect). Set on only one
     * text mark block (`view: "mark"`). The admin editor uses this block to link body text to code lines (line picking, link guidance, highlighting the hovered line).
     */
    readonly codeAnchor?: boolean;
}
export interface BlockChildren {
    /** Block names allowed as children. If absent, holds ordinary body blocks (paragraphs, lists, etc.). */
    readonly blocks?: readonly string[];
    /** Minimum count. A container holding body content may have none if 0 (1 if unset). */
    readonly min?: number;
    readonly max?: number;
}
/** Initial values when inserted from the slash menu. */
export interface BlockInsert {
    /** Initial attribute values. If absent, the attribute's default (`defaultValue`). */
    readonly values?: Readonly<Record<string, string | boolean>>;
    /** Text of the first body paragraph. If absent, an empty paragraph. */
    readonly text?: string;
    /** Initial code of a code fence block. */
    readonly code?: string;
    /** Initial values per child block. If absent, fills with defaults up to the minimum count. */
    readonly children?: readonly Omit<BlockInsert, "children" | "code">[];
}
/**
 * Editor representation.
 *
 * - `opaque`: read-only box that preserves the source (edited in source mode). Default for blocks with no insert UI.
 * - `node`: edited with a dedicated NodeView (`nodeView` name).
 * - `mark`: text mark (inline directive `:name[text]{attrs}`). For added blocks, the admin editor builds the text display from the definition,
 *   and the extension supplies picker tools and bubbles through `marks` in `CmsAdminComponentsProvider`.
 * - `attribute`: represented as another node's attribute (e.g. paragraph alignment).
 */
export interface BlockEditor {
    readonly view: "opaque" | "node" | "mark" | "attribute";
    readonly nodeView?: string;
    /** Shown in the slash menu. */
    readonly insertable?: boolean;
    /** Slash menu search terms. */
    readonly keywords?: readonly string[];
    /** Menu icon (lucide name, e.g. `workflow`). If absent, a puzzle icon. */
    readonly icon?: string;
    /** Initial values when inserted from the slash menu. */
    readonly insert?: BlockInsert;
    /** Text shown when a code fence block is empty. */
    readonly placeholder?: string;
}
export interface BlockDefinition {
    /** Definition name (lowercase kebab-case). For directive blocks, same as the storage syntax name. */
    readonly name: string;
    readonly label: string;
    readonly description?: string;
    readonly syntax: BlockSyntax;
    /** Public renderer name. Uppercase is a component in `MDX_COMPONENTS`; lowercase is an HTML element. */
    readonly component: string;
    /** If a render plugin draws it instead of a component, its name (e.g. math uses `rehype-katex`). */
    readonly renderedBy?: string;
    readonly attributes: Readonly<Record<string, BlockAttribute>>;
    /** Child rules. If absent, takes no children (leaf, fence) or holds ordinary body content (container). */
    readonly children?: BlockChildren;
    /** Usable only inside this block (e.g. `tab` only inside `tabs`). */
    readonly parent?: string;
    /** The translation view expands the box and translates inner blocks one by one (if absent, the whole block is one unit). */
    readonly translateInside?: boolean;
    readonly editor: BlockEditor;
}
export declare const defineBlock: <const B extends BlockDefinition>(definition: B) => B;
