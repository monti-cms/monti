import GithubSlugger from "github-slugger";
import { normalizeUri } from "micromark-util-sanitize-uri";
import type { StoredDocument } from "../../mdx/stored-document";
import type { CmsNode } from "../../mdx/types";
import type { DocumentTocItem, TocRange } from "./types";

/**
 * The part of rendering that needs the whole document and no React: heading anchors, the table of contents and footnote numbers.
 * Anchors and footnotes follow what the MDX chain produced (`rehype-slug`, `remark-gfm`), so links into existing pages keep working.
 */

export const DEFAULT_TOC_RANGE: TocRange = { min: 2, max: 3 };

const CLOBBER_PREFIX = "user-content-";

/** How a footnote label is compared: whitespace collapsed, trimmed, case folded (as micromark reads a label). */
export const footnoteIdentifier = (label: string): string =>
	label.trim().replace(/\s+/g, " ").toUpperCase().toLowerCase();

export interface FootnoteEntry {
	readonly identifier: string;
	/** The label as the definition wrote it. */
	readonly label: string;
	/** The footnote number, by first reference (1-based). */
	readonly index: number;
	readonly definition: CmsNode;
	/** The id of the footnote (`user-content-fn-1`). */
	readonly id: string;
	/** The ids of the references that point here, in order. */
	readonly refIds: string[];
}

export interface FootnoteRef {
	readonly entry: FootnoteEntry;
	/** Which reference of the footnote this is (1-based). */
	readonly count: number;
	readonly refId: string;
}

export interface Analysis {
	/** Heading node → its anchor (headings with a valid level only). */
	readonly slugs: ReadonlyMap<CmsNode, string>;
	/** Every heading in document order. */
	readonly headings: readonly (DocumentTocItem & { readonly node: CmsNode })[];
	/** Reference node → its footnote. A reference without a definition is not in it. */
	readonly refs: ReadonlyMap<CmsNode, FootnoteRef>;
	/** The footnotes that are referenced, in order of first reference. */
	readonly footnotes: readonly FootnoteEntry[];
}

/** The level of a heading node (an integer from 1 to 6), or `undefined` for a malformed one. */
export const headingLevel = (node: CmsNode): 1 | 2 | 3 | 4 | 5 | 6 | undefined => {
	const level = node.attrs?.level;
	return typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= 6
		? (level as 1 | 2 | 3 | 4 | 5 | 6)
		: undefined;
};

const collectDefinitions = (nodes: readonly CmsNode[], into: Map<string, CmsNode>) => {
	for (const node of nodes) {
		if (node.type === "footnoteDefinition" && typeof node.attrs?.label === "string") {
			// The first definition of a label wins.
			const key = footnoteIdentifier(node.attrs.label);
			if (!into.has(key)) into.set(key, node);
		}
		if (node.content) collectDefinitions(node.content, into);
	}
};

export const analyzeDocument = (doc: StoredDocument): Analysis => {
	const definitions = new Map<string, CmsNode>();
	collectDefinitions(doc.content, definitions);

	const slugger = new GithubSlugger();
	const slugs = new Map<CmsNode, string>();
	const headings: (DocumentTocItem & { node: CmsNode })[] = [];
	const refs = new Map<CmsNode, FootnoteRef>();
	const entries = new Map<string, FootnoteEntry>();
	const order: FootnoteEntry[] = [];

	const reference = (node: CmsNode) => {
		const label = node.attrs?.label;
		if (typeof label !== "string") return;
		const identifier = footnoteIdentifier(label);
		const definition = definitions.get(identifier);
		if (!definition) return;
		let entry = entries.get(identifier);
		if (!entry) {
			const safeId = normalizeUri(identifier.toUpperCase().toLowerCase());
			entry = {
				identifier,
				label: String(definition.attrs?.label ?? label),
				index: order.length + 1,
				definition,
				id: `${CLOBBER_PREFIX}fn-${safeId}`,
				refIds: [],
			};
			entries.set(identifier, entry);
			order.push(entry);
		}
		const count = entry.refIds.length + 1;
		const refId = `${entry.id.replace(`${CLOBBER_PREFIX}fn-`, `${CLOBBER_PREFIX}fnref-`)}${count > 1 ? `-${count}` : ""}`;
		entry.refIds.push(refId);
		refs.set(node, { entry, count, refId });
	};

	const textOf = (nodes: readonly CmsNode[] | undefined): string =>
		(nodes ?? [])
			.map((node) => {
				if (node.type === "text") return node.text ?? "";
				if (node.type === "footnoteReference") {
					const found = refs.get(node);
					return found ? String(found.entry.index) : `[^${String(node.attrs?.label ?? "")}]`;
				}
				return textOf(node.content);
			})
			.join("");

	const walk = (node: CmsNode) => {
		if (node.type === "footnoteDefinition") return;
		if (node.type === "footnoteReference") {
			reference(node);
			return;
		}
		for (const child of node.content ?? []) walk(child);
		if (node.type !== "heading") return;
		const level = headingLevel(node);
		if (level === undefined) return;
		const value = textOf(node.content);
		const id = slugger.slug(value);
		slugs.set(node, id);
		headings.push({ node, value, id, href: `#${id}`, level, depth: level });
	};

	for (const node of doc.content) walk(node);
	// The definitions come after the body, in order of first reference; a reference inside one can add a footnote to the end of the list.
	for (let index = 0; index < order.length; index += 1) {
		for (const child of order[index]?.definition.content ?? []) walk(child);
	}

	return { slugs, headings, refs, footnotes: order };
};

/** The headings of the levels in `range`, with `depth` counted from the first level (`0` for an `h2` in the default range). */
export const tocOf = (analysis: Analysis, range: TocRange = DEFAULT_TOC_RANGE): DocumentTocItem[] =>
	analysis.headings
		.filter((heading) => heading.level >= range.min && heading.level <= range.max)
		.map(({ value, id, href, level }) => ({ value, id, href, level, depth: level - range.min }));
