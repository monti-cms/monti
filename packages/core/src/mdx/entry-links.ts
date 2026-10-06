import type { CmsJsonValue, CmsMark, CmsNode } from "./types";

/**
 * Links in a stored document. An internal link is `{ entryId }`: the id of the translation group of the entry it points to (the source entry's id, the same
 * id a relation holds), so the link follows the reader's language and falls back to the source. An external link is `{ href, title? }`. A link never
 * holds both: the address of an internal link is looked up when the document is read, so renaming a slug changes nothing in the document.
 */

/** How a text notation (MDX) writes an entry link: `[text](entry:<id>)`. The id is the only thing it carries. */
export const ENTRY_LINK_PREFIX = "entry:";

const ENTRY_LINK = /^entry:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** The text-notation address of an entry link. */
export const entryLinkHref = (entryId: string): string => `${ENTRY_LINK_PREFIX}${entryId}`;

/** The entry id an address in the form `entry:<id>` names, or `undefined` for any other address. */
export const entryIdOfHref = (href: string): string | undefined => ENTRY_LINK.exec(href)?.[1]?.toLowerCase();

/** The entry id a link mark points to, or `undefined` for an external link (or one with an empty id). */
export const entryIdOfMark = (mark: CmsMark): string | undefined => {
	const id = mark.type === "link" ? mark.attrs?.entryId : undefined;
	return typeof id === "string" && id !== "" ? id : undefined;
};

/** The attributes a link is stored with: only `entryId` for an internal link, `href` and `title` (when there is one) for an external one. */
export const linkAttrs = (attrs: Readonly<Record<string, CmsJsonValue>> | undefined): Record<string, CmsJsonValue> => {
	const entryId = attrs?.entryId;
	if (typeof entryId === "string" && entryId !== "") return { entryId };
	const out: Record<string, CmsJsonValue> = { href: typeof attrs?.href === "string" ? attrs.href : "" };
	if (typeof attrs?.title === "string" && attrs.title !== "") out.title = attrs.title;
	return out;
};

/** The attributes of the link a text notation wrote with this address and title: an `entry:<id>` address is an entry link, any other is an `href`. */
export const linkMarkAttrs = (href: string, title?: string | null): Record<string, CmsJsonValue> => {
	const entryId = entryIdOfHref(href);
	return linkAttrs(entryId ? { entryId } : title ? { href, title } : { href });
};

/** The mark in its stored form: a link mark gets `linkAttrs`, any other mark is returned as it is. */
export const normalizedLinkMark = (mark: CmsMark): CmsMark =>
	mark.type === "link" ? { attrs: linkAttrs(mark.attrs), type: "link" } : mark;

/** Applies `change` to the attributes of every link mark of `nodes`. Returns the same array when no link changed. */
export const mapLinkAttrs = (
	nodes: readonly CmsNode[],
	change: (attrs: Readonly<Record<string, CmsJsonValue>>) => Record<string, CmsJsonValue> | undefined,
): readonly CmsNode[] => {
	let changed = false;
	const out = nodes.map((node): CmsNode => {
		let next = node;
		if (node.marks?.some((mark) => mark.type === "link")) {
			const marks = node.marks.map((mark): CmsMark => {
				if (mark.type !== "link") return mark;
				const attrs = change(mark.attrs ?? {});
				return attrs ? { attrs, type: "link" } : mark;
			});
			if (marks.some((mark, index) => mark !== node.marks?.[index])) next = { ...next, marks };
		}
		if (node.content) {
			const content = mapLinkAttrs(node.content, change);
			if (content !== node.content) next = { ...next, content: content as CmsNode[] };
		}
		if (next !== node) changed = true;
		return next;
	});
	return changed ? out : nodes;
};

/** The distinct entry ids the link marks of `nodes` point to, in document order. */
export const entryLinkIds = (nodes: readonly CmsNode[] | undefined): string[] => {
	const ids = new Set<string>();
	const visit = (list: readonly CmsNode[] | undefined) => {
		for (const node of list ?? []) {
			for (const mark of node.marks ?? []) {
				const id = entryIdOfMark(mark);
				if (id) ids.add(id);
			}
			visit(node.content);
		}
	};
	visit(nodes);
	return [...ids];
};
