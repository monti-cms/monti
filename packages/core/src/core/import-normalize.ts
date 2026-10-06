import type { StoredDocument } from "../mdx/stored-document";
import type { CmsNode } from "../mdx/types";
import { internalLinkAddresses, type LinkResolver, withEntryLinks } from "./link-ids";

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

const isImageWithSrc = (node: CmsNode): node is CmsNode & { attrs: { src: string } } =>
	node.type === "image" &&
	typeof node.attrs?.src === "string" &&
	node.attrs.src !== "" &&
	!(typeof node.attrs.mediaId === "string" && node.attrs.mediaId !== "");

/** The distinct `src` values of the images of `nodes` that are not registered media yet, in document order. */
export const unregisteredImageSources = (nodes: readonly CmsNode[]): string[] => {
	const found = new Set<string>();
	const visit = (list: readonly CmsNode[]) => {
		for (const node of list) {
			if (isImageWithSrc(node)) found.add(node.attrs.src);
			if (node.content) visit(node.content);
		}
	};
	visit(nodes);
	return [...found];
};

const withMediaIds = (nodes: readonly CmsNode[], mediaIds: ReadonlyMap<string, string>): readonly CmsNode[] => {
	let changed = false;
	const out = nodes.map((node): CmsNode => {
		let next = node;
		if (isImageWithSrc(node)) {
			const mediaId = mediaIds.get(node.attrs.src);
			if (mediaId) {
				const { src: _src, ...attrs } = node.attrs;
				// Keys stay sorted, as in every stored document.
				next = {
					...node,
					attrs: Object.fromEntries(Object.entries({ ...attrs, mediaId }).sort(([a], [b]) => (a < b ? -1 : 1))),
				};
			}
		}
		if (node.content) {
			const content = withMediaIds(node.content, mediaIds);
			if (content !== node.content) next = { ...next, content: content as CmsNode[] };
		}
		if (next !== node) changed = true;
		return next;
	});
	return changed ? out : nodes;
};

/** The document with its internal links and registered media turned into ids. It is the same document when nothing changed. */
export async function normalizeImportedDoc(
	doc: StoredDocument,
	normalizers: ImportNormalizers,
): Promise<StoredDocument> {
	let next = doc;
	if (normalizers.links) {
		const addresses = internalLinkAddresses(next.content);
		if (addresses.length > 0) next = withEntryLinks(next, await normalizers.links(addresses));
	}
	if (normalizers.media) {
		const sources = unregisteredImageSources(next.content);
		if (sources.length > 0) {
			const mediaIds = await normalizers.media(sources);
			if (mediaIds.size > 0) {
				const content = withMediaIds(next.content, mediaIds);
				if (content !== next.content) next = { ...next, content: content as CmsNode[] };
			}
		}
	}
	return next;
}
