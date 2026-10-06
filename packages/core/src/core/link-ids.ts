import { mapLinkAttrs } from "../doc/entry-links";
import type { StoredDocument } from "../doc/stored-document";
import type { CmsNode } from "../doc/types";
import { parseInternalLink } from "./links";
import { DEFAULT_LOCALE } from "./locales";

/**
 * Turning the links of an imported body into links by entry id. A format (MDX, an API client, the AI) writes a link to a post as its address
 * (`/posts/slug`); the stored document holds the id of the entry instead, so a rename of the slug changes nothing in the document.
 */

/** The content an address names: a collection and a slug in a language. */
export interface LinkAddress {
	readonly collection: string;
	readonly slug: string;
	/** The language of the address (from the locale prefix of the URL). Absent: the default language. */
	readonly locale?: string;
}

export const linkAddressKey = (address: LinkAddress): string =>
	`${address.collection}:${address.locale ?? DEFAULT_LOCALE}:${address.slug}`;

/**
 * Finds the entries addresses point to: the translation group id of the entry that holds each address (a current address, a former one or a draft's
 * reservation). An address nobody holds is left out of the result. The key is `linkAddressKey`.
 */
export type LinkResolver = (addresses: readonly LinkAddress[]) => Promise<ReadonlyMap<string, string>>;

/** The distinct addresses of the links of a document that point into this site's content, in document order. */
export const internalLinkAddresses = (content: readonly CmsNode[]): LinkAddress[] => {
	const found = new Map<string, LinkAddress>();
	mapLinkAttrs(content, (attrs) => {
		const target = typeof attrs.href === "string" ? parseInternalLink(attrs.href) : null;
		if (target)
			found.set(linkAddressKey(target), {
				collection: target.collection,
				slug: target.slug,
				...(target.locale ? { locale: target.locale } : {}),
			});
		return undefined;
	});
	return [...found.values()];
};

/**
 * The document with every internal link whose address is in `entryIds` turned into a link by id. A link whose address is not there stays as it
 * is (publishing reports it as `unresolved_internal_link`). Returns the same document when nothing changed.
 */
export const withEntryLinks = (doc: StoredDocument, entryIds: ReadonlyMap<string, string>): StoredDocument => {
	const content = mapLinkAttrs(doc.content, (attrs) => {
		const target = typeof attrs.href === "string" ? parseInternalLink(attrs.href) : null;
		const entryId = target ? entryIds.get(linkAddressKey(target)) : undefined;
		return entryId ? { entryId } : undefined;
	});
	return content === doc.content ? doc : { ...doc, content: content as CmsNode[] };
};
