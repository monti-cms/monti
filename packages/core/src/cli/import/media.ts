import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { Cms } from "../../cms";
import type { CmsNode } from "../../doc/types";
import { completeMediaUpload, prepareMediaUpload } from "../../http/v1/media/upload-flow";
import type { ImportState } from "./state";

/**
 * Local images. An image of a body (`![alt](./cover.png)`, `![](/images/a.png)`) or of a media field that is a file on disk is uploaded to the configured media
 * storage and the document points to the media item by id. Without media storage the image is copied into the app's `public/` folder (`public/media/cover.png`)
 * and the document points to that address, so it shows on the site with no storage; an image that is already under `public/` keeps its address.
 */

/** The folder inside `public/` the copies go to. */
export const COPY_FOLDER = "media";

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
};

const REMOTE = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/** The file on disk an image address stands for, or `undefined` when it is a remote address or no file is there. */
export function localImageFile(
	src: string,
	sourceFile: string,
	publicDirs: readonly string[],
): { file: string } | { missing: string } | undefined {
	if (src === "" || REMOTE.test(src)) return undefined;
	let clean = src.replace(/[?#].*$/, "");
	try {
		clean = decodeURI(clean);
	} catch {
		// The address is used as written.
	}
	const candidates = clean.startsWith("/")
		? publicDirs.map((dir) => path.join(dir, clean))
		: [path.resolve(path.dirname(sourceFile), clean), ...publicDirs.map((dir) => path.join(dir, clean))];
	const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
	return found ? { file: found } : { missing: src };
}

export interface MediaImporter {
	/** Whether the site has media storage to upload to. */
	readonly configured: boolean;
	/**
	 * The media item for an image address in a file: its id, or why there is none. In a dry run nothing is uploaded and `mediaId` is `undefined` for an image that
	 * would be.
	 */
	resolve(
		src: string,
		sourceFile: string,
	): Promise<{ mediaId?: string; url?: string; wouldUpload?: boolean; warning?: string } | undefined>;
	readonly stats: {
		uploaded: number;
		reused: number;
		wouldUpload: number;
		bytes: number;
		copied: number;
		wouldCopy: number;
	};
}

/** Whether `child` is `parent` or inside it. */
const isInside = (parent: string, child: string): boolean => {
	const relative = path.relative(parent, child);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

/**
 * Copies an image into `<publicDir>/media/` and returns the address that serves it (`/media/cover.png`). A file with that name and the same bytes is reused; one
 * with other bytes gets a short hash in its name, so two images never overwrite each other. In a dry run nothing is written.
 */
export function copyToPublic(
	file: string,
	publicDir: string,
	dryRun: boolean,
	/** In a dry run nothing is written, so the names already given out are remembered here (name -> hash of its bytes). */
	reserved: Map<string, string> = new Map(),
): { url: string; copied: boolean } {
	const bytes = readFileSync(file);
	const hash = createHash("sha256").update(bytes).digest("hex");
	const extension = path.extname(file);
	const stem = path.basename(file, extension).replace(/[^A-Za-z0-9._-]+/g, "-") || "image";
	const folder = path.join(publicDir, COPY_FOLDER);
	const holds = (name: string): "same" | "other" | "free" => {
		const given = reserved.get(name);
		if (given !== undefined) return given === hash ? "same" : "other";
		const target = path.join(folder, name);
		if (!existsSync(target)) return "free";
		return readFileSync(target).equals(bytes) ? "same" : "other";
	};
	let name = `${stem}${extension}`;
	if (holds(name) === "other") name = `${stem}-${hash.slice(0, 8)}${extension}`;
	const state = holds(name);
	if (state === "free") {
		reserved.set(name, hash);
		if (!dryRun) {
			mkdirSync(folder, { recursive: true });
			copyFileSync(file, path.join(folder, name));
		}
	}
	return { url: `/${COPY_FOLDER}/${name}`, copied: state === "free" };
}

export function createMediaImporter(options: {
	readonly cms: Cms;
	readonly state: ImportState;
	readonly publicDirs: readonly string[];
	/** The folder the site serves files from (`public`). Without media storage, images that are not already in it are copied here. */
	readonly copyTo?: string;
	readonly dryRun: boolean;
}): MediaImporter {
	const { cms, state, publicDirs, dryRun, copyTo } = options;
	const stats = { uploaded: 0, reused: 0, wouldUpload: 0, bytes: 0, copied: 0, wouldCopy: 0 };
	const done = new Map<string, Promise<{ mediaId?: string; wouldUpload?: boolean; warning?: string }>>();
	const reservedNames = new Map<string, string>();

	async function upload(file: string): Promise<{ mediaId?: string; wouldUpload?: boolean; warning?: string }> {
		const mimeType = MIME_BY_EXTENSION[path.extname(file).toLowerCase()];
		const name = path.basename(file);
		if (!mimeType || !(cms.site.api.ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
			return { warning: `${name} is not an image type the media library accepts, so it stays a URL` };
		}
		const bytes = readFileSync(file);
		if (bytes.byteLength > cms.site.api.MAX_MEDIA_BYTES) {
			return {
				warning: `${name} is larger than the media limit (${cms.site.api.MAX_MEDIA_BYTES} bytes), so it stays a URL`,
			};
		}
		const sha = createHash("sha256").update(bytes).digest("hex");
		const known = await state.media(sha);
		if (known) {
			const asset = await cms.store().getMediaAsset(known.mediaId);
			if (asset?.status === "ready") {
				stats.reused += 1;
				return { mediaId: known.mediaId };
			}
		}
		if (dryRun) {
			stats.wouldUpload += 1;
			stats.bytes += bytes.byteLength;
			return { wouldUpload: true };
		}
		try {
			const prepared = await prepareMediaUpload(cms, { filename: name, mimeType, byteSize: bytes.byteLength });
			const response = await fetch(prepared.uploadUrl, {
				method: prepared.method,
				headers: prepared.requiredHeaders,
				body: bytes,
			});
			if (!response.ok) throw new Error(`the storage answered ${response.status}`);
			await completeMediaUpload(cms, prepared.mediaId);
			await state.putMedia(sha, { mediaId: prepared.mediaId, filename: name, byteSize: bytes.byteLength });
			stats.uploaded += 1;
			stats.bytes += bytes.byteLength;
			return { mediaId: prepared.mediaId };
		} catch (error) {
			return {
				warning: `${name} could not be uploaded (${error instanceof Error ? error.message : String(error)}), so it stays a URL`,
			};
		}
	}

	return {
		configured: cms.isMediaConfigured,
		stats,
		async resolve(src, sourceFile) {
			const found = localImageFile(src, sourceFile, publicDirs);
			if (!found) return undefined;
			if ("missing" in found)
				return { warning: `the image ${found.missing} was not found on disk, so it stays as written` };
			if (!cms.isMediaConfigured) {
				const name = path.basename(found.file);
				if (!copyTo) {
					return {
						warning: `${name} stays a URL: no media storage is configured and no public folder was found to copy it to`,
					};
				}
				// Already served from public/: its address works as it is.
				if (isInside(copyTo, found.file) && src.startsWith("/")) return undefined;
				if (isInside(copyTo, found.file)) {
					return { url: `/${path.relative(copyTo, found.file).split(path.sep).join("/")}` };
				}
				try {
					const copy = copyToPublic(found.file, copyTo, dryRun, reservedNames);
					if (copy.copied) stats[dryRun ? "wouldCopy" : "copied"] += 1;
					return { url: copy.url };
				} catch (error) {
					return {
						warning: `${name} could not be copied to ${path.basename(copyTo)}/ (${error instanceof Error ? error.message : String(error)}), so it stays as written`,
					};
				}
			}
			let pending = done.get(found.file);
			if (!pending) {
				pending = upload(found.file);
				done.set(found.file, pending);
			}
			return pending;
		},
	};
}

/** The distinct `src` of the images of a document that are not media yet. */
export function imageSources(nodes: readonly CmsNode[]): string[] {
	const found = new Set<string>();
	const visit = (list: readonly CmsNode[]) => {
		for (const node of list) {
			if (
				node.type === "image" &&
				typeof node.attrs?.src === "string" &&
				node.attrs.src !== "" &&
				!node.attrs.mediaId
			) {
				found.add(node.attrs.src);
			}
			if (node.content) visit(node.content);
		}
	};
	visit(nodes);
	return [...found];
}

/** The nodes with the `src` of the images in `urls` replaced by the address they were copied to. Returns the same array when nothing changed. */
export function withImageUrls(nodes: readonly CmsNode[], urls: ReadonlyMap<string, string>): readonly CmsNode[] {
	let changed = false;
	const out = nodes.map((node): CmsNode => {
		let next = node;
		if (node.type === "image" && typeof node.attrs?.src === "string") {
			const url = urls.get(node.attrs.src);
			if (url) next = { ...node, attrs: { ...node.attrs, src: url } };
		}
		if (node.content) {
			const content = withImageUrls(node.content, urls);
			if (content !== node.content) next = { ...next, content: [...content] };
		}
		if (next !== node) changed = true;
		return next;
	});
	return changed ? out : nodes;
}

/** The nodes with the images of `mediaIds` (by `src`) turned into media items. Returns the same array when nothing changed. */
export function withMediaIds(nodes: readonly CmsNode[], mediaIds: ReadonlyMap<string, string>): readonly CmsNode[] {
	let changed = false;
	const out = nodes.map((node): CmsNode => {
		let next = node;
		if (node.type === "image" && typeof node.attrs?.src === "string") {
			const mediaId = mediaIds.get(node.attrs.src);
			if (mediaId) {
				const { src: _src, ...attrs } = node.attrs;
				next = {
					...node,
					attrs: Object.fromEntries(Object.entries({ ...attrs, mediaId }).sort(([a], [b]) => (a < b ? -1 : 1))),
				};
			}
		}
		if (node.content) {
			const content = withMediaIds(node.content, mediaIds);
			if (content !== node.content) next = { ...next, content: [...content] };
		}
		if (next !== node) changed = true;
		return next;
	});
	return changed ? out : nodes;
}
