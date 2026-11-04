import { type Doc, walk } from "./doc";

/** A link mark's `href` that points at an entry by its translation group, so the link holds when the entry's slug changes (doc 03). */
export const ENTRY_LINK = "monti:entry/";

export const entryLink = (group: string) => `${ENTRY_LINK}${group}`;

/** The translation group an `href` points at, or `null` for an ordinary address. */
export const linkedGroup = (href: unknown) =>
	typeof href === "string" && href.startsWith(ENTRY_LINK) ? href.slice(ENTRY_LINK.length) : null;

/** Every translation group the body links to. */
export function linkedGroups(doc: Doc): string[] {
	const groups = new Set<string>();
	for (const { block } of walk(doc.blocks))
		for (const inline of block.content ?? [])
			for (const mark of inline.type === "text" ? (inline.marks ?? []) : []) {
				const group = mark.type === "link" ? linkedGroup(mark.href) : null;
				if (group) groups.add(group);
			}
	return [...groups];
}
