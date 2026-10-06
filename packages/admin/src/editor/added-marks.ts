import { ADDED_MARK_BLOCKS, type BlockDefinition } from "@monti-cms/core/client";
import type { CmsJsonValue } from "@monti-cms/core/document";
import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Editor display of added text styles (blocks from extensions or a site config's `syntax.kind: "text"` blocks). The core editor does not know style names and builds
 * Tiptap marks from block definitions. The look (classes, styles) and tools (formatting tools, bubble, slash menu) are provided by extensions through `CmsAdminComponentsProvider`'s
 * `marks` (block name → `EditorMarkExtension`).
 *
 * - A mark name is `cms` + the Pascal-case block name (`tooltip` → `cmsTooltip`, `code-ref` → `cmsCodeRef`).
 * - Attributes are the definition's attributes. In the stored document (CmsNode), the mark name is the block name and the attributes are the same.
 * - In HTML it is drawn as `span[data-cms-mark="block name"]` with `data-mark-<attribute>` for each attribute (paste reads this shape too).
 */

export type MarkAttrs = Readonly<Record<string, unknown>>;

/** Mark look that an extension changes. */
export interface EditorMarkSpec {
	/** Whether text typed right after the style also inherits it. If absent, it does not. */
	readonly inclusive?: boolean;
	/** HTML attributes to add to the `span` (`class`, `style`, `data-*`). Built from the attribute values (`attrs`). */
	readonly render?: (attrs: MarkAttrs) => Record<string, string>;
}

const pascal = (name: string) =>
	name.replace(/(^|-)([a-z0-9])/g, (_, _dash: string, char: string) => char.toUpperCase());
const kebab = (name: string) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/** Editor mark name of an added text style (`cms` + Pascal-case block name). */
export const addedMarkName = (blockName: string) => `cms${pascal(blockName)}`;

/** HTML attribute name for one attribute. */
const dataAttribute = (name: string) => `data-mark-${kebab(name)}`;

/** Added text styles (block name → definition). */
export const ADDED_MARKS: ReadonlyMap<string, BlockDefinition> = new Map(
	ADDED_MARK_BLOCKS.map((block) => [block.name, block]),
);

/** Editor mark name → added text style definition. */
export const ADDED_MARK_BY_EDITOR_NAME: ReadonlyMap<string, BlockDefinition> = new Map(
	ADDED_MARK_BLOCKS.map((block) => [addedMarkName(block.name), block]),
);

/**
 * Style attributes keeping only the definition's attributes. Strings are kept when they have a value, required attributes (`required`) are kept even when empty (`""`). Booleans only when true.
 * Used in both directions, stored document (CmsNode) ↔ editor mark (serialization uses the same rule, so a round trip keeps the text the same).
 */
export function markAttrsOf(block: BlockDefinition, attrs: MarkAttrs | null | undefined): Record<string, CmsJsonValue> {
	const out: Record<string, CmsJsonValue> = {};
	for (const [name, attribute] of Object.entries(block.attributes)) {
		const value = attrs?.[name];
		if (attribute.type === "boolean") {
			if (value === true || value === "true") out[name] = true;
			continue;
		}
		if (typeof value === "string" && value !== "") out[name] = value;
		else if (attribute.required) out[name] = typeof value === "number" ? String(value) : "";
	}
	return out;
}

/** Attribute pointing to a line label (`codeAnchor`). */
const anchorAttribute = (block: BlockDefinition) =>
	Object.entries(block.attributes).find(([, attribute]) => attribute.codeAnchor)?.[0];

/** Tiptap mark for one added text style. */
export function createAddedMark(block: BlockDefinition, spec: EditorMarkSpec = {}) {
	const attributes = Object.entries(block.attributes);
	const anchor = anchorAttribute(block);
	return Mark.create({
		name: addedMarkName(block.name),
		inclusive: spec.inclusive ?? false,
		addAttributes() {
			return Object.fromEntries(
				attributes.map(([name, attribute]) => [
					name,
					{
						default: null,
						parseHTML: (element: HTMLElement) => {
							const value = element.getAttribute(dataAttribute(name));
							return attribute.type === "boolean" ? value !== null || null : value;
						},
						// Not drawn per attribute; all are drawn at once in `renderHTML` below.
						renderHTML: () => ({}),
					},
				]),
			);
		},
		parseHTML() {
			return [{ tag: `span[data-cms-mark="${block.name}"]` }];
		},
		renderHTML({ mark, HTMLAttributes }) {
			const attrs = mark.attrs as MarkAttrs;
			const data = Object.fromEntries(
				Object.entries(markAttrsOf(block, attrs)).map(([name, value]) => [
					dataAttribute(name),
					value === true ? "" : String(value),
				]),
			);
			const anchorValue = anchor ? attrs[anchor] : undefined;
			return [
				"span",
				mergeAttributes(
					HTMLAttributes,
					{ "data-cms-mark": block.name, ...data },
					// When pointing at a code line label, the editor code block highlights the line the mouse is over (`data-code-ref`).
					typeof anchorValue === "string" && anchorValue ? { "data-code-ref": anchorValue } : {},
					spec.render?.(attrs) ?? {},
				),
				0,
			];
		},
	});
}

/** A style linking body text and a code line (blocks with `codeAnchor` in their attributes). If none, the code block's link tool is hidden. */
export const CODE_ANCHOR_REF: { readonly mark: string; readonly attribute: string } | null = (() => {
	for (const block of ADDED_MARK_BLOCKS) {
		const attribute = anchorAttribute(block);
		if (attribute) return { mark: addedMarkName(block.name), attribute };
	}
	return null;
})();
