import type { StoredDocument } from "../doc/stored-document.js";
import type { CmsNode } from "../doc/types.js";
import type { Site } from "../site/index.js";
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
export declare const linkAddressKey: (site: Pick<Site, "DEFAULT_LOCALE">, address: LinkAddress) => string;
/**
 * Finds the entries addresses point to: the translation group id of the entry that holds each address (a current address, a former one or a draft's
 * reservation). An address nobody holds is left out of the result. The key is `linkAddressKey`.
 */
export type LinkResolver = (addresses: readonly LinkAddress[]) => Promise<ReadonlyMap<string, string>>;
/** The distinct addresses of the links of a document that point into this site's content, in document order. */
export declare const internalLinkAddresses: (site: Site, content: readonly CmsNode[]) => LinkAddress[];
/**
 * The document with every internal link whose address is in `entryIds` turned into a link by id. A link whose address is not there stays as it
 * is (publishing reports it as `unresolved_internal_link`). Returns the same document when nothing changed.
 */
export declare const withEntryLinks: (site: Site, doc: StoredDocument, entryIds: ReadonlyMap<string, string>) => StoredDocument;
