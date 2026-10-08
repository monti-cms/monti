import type { StoredDocument } from "../doc/stored-document.js";
import type { CmsNode } from "../doc/types.js";
import type { Site } from "../site/index.js";
import { type LinkResolver } from "./link-ids.js";
/**
 * Core's normalisation of a document that came from outside (a text in any format, the API, the AI): whatever notation it was written in, the stored
 * document refers to entries and media by id. A link written as the address of this site's content (`/posts/slug`) becomes a link by entry id, and an
 * image whose `src` is the public URL of a registered media file becomes a registered image (`mediaId`). What nobody holds stays as written (publishing reports
 * a link to an unheld address as `unresolved_internal_link`).
 */
/** The media id each public URL belongs to. A URL that is not a registered media file is left out. */
export type MediaUrlResolver = (urls: readonly string[]) => Promise<ReadonlyMap<string, string>>;
export interface ImportNormalizers {
    readonly links?: LinkResolver;
    readonly media?: MediaUrlResolver;
}
/** The distinct `src` values of the images of `nodes` that are not registered media yet, in document order. */
export declare const unregisteredImageSources: (nodes: readonly CmsNode[]) => string[];
/** The document with its internal links and registered media turned into ids. It is the same document when nothing changed. */
export declare function normalizeImportedDoc(site: Site, doc: StoredDocument, normalizers: ImportNormalizers): Promise<StoredDocument>;
