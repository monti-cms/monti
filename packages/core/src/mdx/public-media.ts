import type { MediaStore } from "../adapters/r2/types";
import type { ContentStore } from "../core/store";
import { analyze } from "./analyze";
import { type ImageResolveResult, resolveImageUrl } from "./image-src";

type MdxNode = {
	type?: unknown;
	name?: unknown;
	attributes?: unknown;
	children?: unknown;
};

type MdxAttribute = { name?: unknown; value?: unknown };

const isNode = (value: unknown): value is MdxNode => typeof value === "object" && value !== null;
const isAttribute = (value: unknown): value is MdxAttribute => typeof value === "object" && value !== null;

function readAttribute(node: MdxNode, name: string): string | undefined {
	if (!Array.isArray(node.attributes)) return undefined;
	const attribute = node.attributes.find((item) => isAttribute(item) && item.name === name);
	return typeof attribute?.value === "string" ? attribute.value : undefined;
}

function collectMediaIds(source: string): string[] {
	const ids = new Set<string>();
	const tree = analyze(source).tree;
	const visit = (node: unknown) => {
		if (!isNode(node)) return;
		// The attachment file card uses the same media table.
		if (
			(node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
			(node.name === "Image" || node.name === "File")
		) {
			const mediaId = readAttribute(node, "mediaId");
			if (mediaId) ids.add(mediaId);
		}
		if (Array.isArray(node.children)) node.children.forEach(visit);
	};
	visit(tree);
	return [...ids];
}

/** The stores the public media helpers read. They are looked up when used, so nothing connects until then. */
export interface PublicMediaDeps {
	readonly store: () => ContentStore;
	readonly mediaStore: () => MediaStore;
}

/**
 * Resolves registered media ids into public URLs, sizes and file info (a ready file) or the reason there is none. Ids with no media row are left out
 * (the resolvers read them as unresolved). A deployment without a database or storage resolves nothing and still renders.
 */
export async function resolvePublicMedia(
	deps: PublicMediaDeps,
	mediaIds: readonly string[],
): Promise<Map<string, ImageResolveResult>> {
	const urls = new Map<string, ImageResolveResult>();
	if (mediaIds.length === 0) return urls;
	try {
		const store = deps.store();
		const mediaStore = deps.mediaStore();
		await Promise.all(
			mediaIds.map(async (mediaId) => {
				const media = await store.getMediaAsset(mediaId);
				if (!media) return;
				if (media.status !== "ready") {
					urls.set(mediaId, { failure: "not-ready" });
					return;
				}
				if (!media.storageKey) {
					urls.set(mediaId, { failure: "unresolved" });
					return;
				}
				const url = mediaStore.getPublicUrl(media.storageKey);
				const { width, height } = media;
				const file = { filename: media.filename, byteSize: media.byteSize, mimeType: media.mimeType };
				urls.set(mediaId, width && height && width > 0 && height > 0 ? { url, width, height, file } : { url, file });
			}),
		);
	} catch {
		// Keystatic/public-only deployments may not configure the CMS database or R2.
		// Keep rendering and let CmsImage show its neutral fallback.
	}
	return urls;
}

/**
 * Connects public MDX so that it resolves registered media into actual public URLs.
 * @deprecated Reads the MDX text again to find the media. Read the stored document instead (`entry.doc`, `entry.refs`) and render it with `CmsContent`.
 */
export async function createPublicImageResolver(deps: PublicMediaDeps, source: string) {
	const urls = await resolvePublicMedia(deps, collectMediaIds(source));
	return ({ mediaId, src }: { mediaId?: string; src?: string }): ImageResolveResult => {
		if (mediaId) return urls.get(mediaId) ?? { failure: "unresolved" };
		return resolveImageUrl(src) ?? { failure: "unresolved" };
	};
}

/**
 * Public URL of one media item (shared image etc.). `null` if it is not ready or the deployment has no DB or storage.
 */
export async function resolvePublicMediaUrl(
	deps: PublicMediaDeps,
	mediaId: string,
): Promise<{ url: string; width?: number; height?: number } | null> {
	try {
		const media = await deps.store().getMediaAsset(mediaId);
		if (!media || media.status !== "ready" || !media.storageKey) return null;
		const url = deps.mediaStore().getPublicUrl(media.storageKey);
		return media.width && media.height ? { url, width: media.width, height: media.height } : { url };
	} catch {
		return null;
	}
}
