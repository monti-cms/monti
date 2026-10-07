import type { Site } from "@monti-cms/core/client";
import { perSite } from "./per-site";

/** The JSX names of a site's body: which elements the body may hold, which of them are blocks, and which are text decorations (marks). */
export interface JsxRegistry {
	/** Every renderer name the body may use: the standard elements and the site's added blocks. */
	readonly REGISTERED_JSX_NAMES: ReadonlySet<string>;
	/** Renderer names of elements that are blocks (not text decorations). */
	readonly BLOCK_JSX_NAMES: ReadonlySet<string>;
	/** Text decoration renderer name → document mark name. For added text decorations (block extensions), the block name is the mark name. */
	readonly INLINE_JSX_MARKS: Readonly<Record<string, string>>;
}

/** The JSX names of a site, built from its added blocks. */
export const jsxRegistryOf = perSite((site: Site): JsxRegistry => {
	/** Public renderer names of added blocks (block extensions and site config). */
	const addedComponents = site.ADDED_BLOCKS.map((block) => block.component);
	/** Renderer names of added blocks that are not text decorations. */
	const addedBlockComponents = site.ADDED_BLOCKS.filter((block) => block.syntax.kind !== "text").map(
		(block) => block.component,
	);
	return {
		REGISTERED_JSX_NAMES: new Set([
			"Untranslated",
			"u",
			"strong",
			"em",
			"del",
			"sup",
			"sub",
			"br",
			"TextAlign",
			"Image",
			"File",
			"CodeBlock",
			"Math",
			"Table",
			"TableRow",
			"TableCell",
			...addedComponents,
		]),
		BLOCK_JSX_NAMES: new Set([
			"TextAlign",
			"Image",
			"File",
			"CodeBlock",
			"Math",
			"Table",
			"TableRow",
			"TableCell",
			...addedBlockComponents,
		]),
		INLINE_JSX_MARKS: {
			u: "underline",
			strong: "bold",
			em: "italic",
			del: "strike",
			sup: "superscript",
			sub: "subscript",
			Untranslated: "untranslated",
			...Object.fromEntries(site.ADDED_MARK_BLOCKS.map((block) => [block.component, block.name])),
		},
	};
});

/** Names removed in batch 4. If one remains in the body, `analyze` rejects it (read compatibility is also over). */
export const RETIRED_JSX_NAMES = new Set(["ContentLink", "IdeographicSpace"]);

/** Event handler attribute names. React does not preserve case, so `onerror` is blocked as well. */
export const EVENT_HANDLER_NAME = /^on[a-z]/i;
