import type { Message } from "@monti-cms/core";

/** One block of `blocks.catalog` (doc 03): what the editor needs to draw it, offer it and check it. */
export type CatalogBlock = {
	type: string;
	label: string | Message;
	description: string;
	menu: "text" | "insert" | "component" | null;
	holds: "text" | "blocks" | "nothing";
	children: string[] | null;
	/** The attrs' JSON schema, or `null` when the block has none. */
	attrs: { properties?: Record<string, unknown>; required?: string[] } | null;
};

export type CatalogMark = { type: string; label: string | Message; attrs: unknown };

/** What `blocks.catalog` answers. */
export type Catalog = { blocks: CatalogBlock[]; marks: CatalogMark[]; headings: number[] };

/**
 * The body's two catalogs: `kit` is every block and mark the site has (the editor can draw all of them), `offered` is what this collection's editor
 * offers in its menus (doc 03: the allowance filters the menus only; a block it does not offer stays in the text with the "off" mark).
 */
export type BodyCatalogs = { kit: Catalog; offered: Catalog };

/** Whether a block takes attrs it was not given: a block with required attrs cannot be put in from a menu without a form of its own. */
export const needsAttrs = (block: CatalogBlock) => (block.attrs?.required?.length ?? 0) > 0;

/** Whether the block's definition has an `align` attr: only then does its block menu have "align" (editor-tools.md). */
export const alignable = (block: CatalogBlock | undefined) => Boolean(block?.attrs?.properties?.align);

/** Blocks that need their own feature before the "/" menu can put them in: an image and a file come from the media library (doc 09, T33). */
export const NOT_FROM_MENU: ReadonlySet<string> = new Set(["image", "file"]);
