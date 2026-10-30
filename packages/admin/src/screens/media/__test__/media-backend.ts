import type { Folder, FolderListItem, FolderTrashResult, MediaTrashResult, TrashTarget } from "@monti-cms/core/site";
import type { MediaItem, MediaPage, UploadCompletion } from "../../../api/media";
import type { TrashRestoreOutcome } from "../../../api/trash";
import type { FakeApi } from "../../../test/fake-api";

/** What the fake media API answers: a body, or an error answer. */
export type Answer = { status?: number; body: unknown };

export const image = (id: string, fields: Partial<MediaItem> = {}): MediaItem => ({
	id,
	folderId: null,
	status: "ready",
	filename: `${id}.jpg`,
	mimeType: "image/jpeg",
	byteSize: 412_000,
	width: 2400,
	height: 1600,
	publicUrl: `https://media.example/${id}.jpg`,
	original: null,
	defaultAlt: "A desk",
	defaultCaption: "",
	createdAt: "2026-10-12T09:00:00.000Z",
	referencesCount: 0,
	references: [],
	...fields,
});

export const pdf = (id: string, fields: Partial<MediaItem> = {}): MediaItem =>
	image(id, {
		filename: `${id}.pdf`,
		mimeType: "application/pdf",
		width: null,
		height: null,
		byteSize: 2_100_000,
		defaultAlt: "",
		...fields,
	});

export const folderItem = (
	id: string,
	name: string,
	parentId: string | null = null,
	entryCount = 0,
): FolderListItem => ({
	id,
	collection: "media",
	parentId,
	name,
	position: 0,
	version: 2,
	entryCount,
});

type MediaPatch = { filename?: string; defaultAlt?: string; defaultCaption?: string; folderId?: string | null };

/**
 * The media API as the library sees it, over a list of files and folders: the list with its folder, search and filter conditions and the counts the filter
 * menus show, the folders, a move, the trash, a replacement and the restore. A test swaps `onTrash` to make the server keep a file. It keeps the state, so
 * a list read again after a move shows the file in its new place. Tests reach it through `mount` on the shared fake API; the Storybook frame, which has a
 * fake of its own, through `handle`.
 */
export class MediaBackend {
	items: MediaItem[];
	folders: FolderListItem[];
	onTrash: (ids: string[]) => MediaTrashResult = (ids) => ({ trashed: ids, kept: [] });
	onFolderDelete: (id: string) => FolderTrashResult = (id) => this.trashedFolder(id);

	constructor(items: MediaItem[], folders: FolderListItem[] = []) {
		this.items = items;
		this.folders = folders;
	}

	private inside(folderId: string, id: string | null): boolean {
		for (let at = id; at; at = this.folders.find((f) => f.id === at)?.parentId ?? null)
			if (at === folderId) return true;
		return false;
	}

	/** What the server answers for a folder that went to the trash with three unused files. */
	trashedFolder(id: string): FolderTrashResult {
		const folder = this.folders.find((f) => f.id === id);
		return {
			folder: {
				type: "folder",
				id,
				collection: "media",
				name: folder?.name ?? id,
				version: (folder?.version ?? 1) + 1,
				deletedAt: new Date("2026-10-12T10:00:00.000Z"),
				expiresAt: null,
				path: [],
				entries: 0,
				folders: 0,
				files: 3,
			},
			entries: 0,
			folders: 0,
			files: 3,
			kept: 0,
		};
	}

	list(query: URLSearchParams): MediaPage {
		const folderId = query.get("folderId");
		const text = query.get("search")?.toLowerCase();
		const scope = (item: MediaItem) => {
			if (folderId === null) return true;
			if (folderId === "null") return (item.folderId ?? null) === null;
			return query.get("includeDescendants") === "true"
				? this.inside(folderId, item.folderId ?? null)
				: item.folderId === folderId;
		};
		const base = this.items.filter(
			(item) =>
				scope(item) &&
				(!text || item.filename.toLowerCase().includes(text)) &&
				(query.get("used") !== "used" || item.referencesCount > 0) &&
				(query.get("used") !== "unused" || item.referencesCount === 0),
		);
		const isImage = (item: MediaItem) => item.mimeType?.startsWith("image/") ?? false;
		const kind = query.get("kind");
		const alt = query.get("alt");
		const sort = query.get("sort") ?? "uploaded";
		// The list is kept newest first as given; the other orders sort it.
		const ordered =
			sort === "uploadedAsc"
				? [...base].reverse()
				: sort === "name"
					? [...base].sort((a, b) => a.filename.toLowerCase().localeCompare(b.filename.toLowerCase()))
					: sort === "size"
						? [...base].sort((a, b) => (b.byteSize ?? 0) - (a.byteSize ?? 0))
						: base;
		const items = ordered.filter(
			(item) =>
				(kind !== "image" || isImage(item)) &&
				(kind !== "file" || !isImage(item)) &&
				(!alt || (isImage(item) && (alt === "none") === (item.defaultAlt.trim() === ""))),
		);
		const images = base.filter(isImage);
		return {
			items,
			total: items.length,
			kinds: { image: images.length, file: base.length - images.length },
			alts: {
				none: images.filter((item) => item.defaultAlt.trim() === "").length,
				has: images.filter((item) => item.defaultAlt.trim() !== "").length,
			},
		};
	}

	createFolder(body: { name: string; parentId?: string | null }): Folder {
		const created = folderItem(`new-${this.folders.length}`, String(body.name), body.parentId ?? null);
		this.folders = [...this.folders, created];
		return created;
	}

	updateFolder(id: string, body: { name?: string; parentId?: string | null }) {
		this.folders = this.folders.map((f) => (f.id === id ? { ...f, ...body, version: f.version + 1 } : f));
		return this.folders.find((f) => f.id === id);
	}

	updateMedia(id: string, body: MediaPatch): undefined {
		this.items = this.items.map((item) =>
			item.id === id
				? {
						...item,
						...(body.filename !== undefined ? { filename: String(body.filename) } : {}),
						...(body.defaultAlt !== undefined ? { defaultAlt: String(body.defaultAlt) } : {}),
						...(body.defaultCaption !== undefined ? { defaultCaption: String(body.defaultCaption) } : {}),
						...("folderId" in body ? { folderId: body.folderId ?? null } : {}),
					}
				: item,
		);
		return undefined;
	}

	trash(ids: string[]): MediaTrashResult {
		const result = this.onTrash(ids);
		this.items = this.items.filter((item) => !result.trashed.includes(item.id));
		return result;
	}

	replace(id: string): UploadCompletion {
		const target = this.items.find((item) => item.id === id);
		return {
			mediaId: id,
			publicUrl: target?.publicUrl ?? null,
			// The client type says a number; the server sends null for a file that is not a picture.
			width: target?.width ?? 0,
			height: target?.height ?? 0,
			defaultAlt: target?.defaultAlt ?? "",
			defaultCaption: target?.defaultCaption ?? "",
		};
	}

	restore(items: TrashTarget[]): { results: TrashRestoreOutcome[] } {
		return { results: items.map((item) => ({ type: item.type, id: item.id, ok: true })) };
	}

	/** Answers the library's routes on the shared fake API. */
	mount(api: FakeApi) {
		api
			.on("GET /v1/media", ({ query }) => this.list(query))
			.on("GET /v1/folders", () => this.folders)
			.on("POST /v1/folders", ({ body }) => this.createFolder(body))
			.on("PATCH /v1/folders/:id", ({ params, body }) => this.updateFolder(params.id as string, body))
			.on("DELETE /v1/folders/:id", ({ params }) => this.onFolderDelete(params.id as string))
			.on("PATCH /v1/media/:id", ({ params, body }) => this.updateMedia(params.id as string, body))
			.on("POST /v1/media/trash", ({ body }) => this.trash(body?.ids ?? []))
			.on("POST /v1/media/:id/replace", ({ params }) => this.replace(params.id as string))
			.on("POST /v1/trash/restore", ({ body }) => this.restore(body?.items ?? []));
		return api;
	}

	/** Answers a request of the Storybook frame's fake, or `undefined` for one that is not the media's (the frame answers those). */
	handle(url: URL, method: string, body?: Record<string, unknown>): Answer | undefined {
		const path = url.pathname.replace("/api/monti/v1", "");
		const id = (pattern: RegExp) => {
			const found = path.match(pattern)?.[1];
			return found === undefined ? undefined : decodeURIComponent(found);
		};
		const given = body ?? {};
		if (path === "/media" && method === "GET") return { body: this.list(url.searchParams) };
		if (path === "/folders" && method === "GET") return { body: this.folders };
		if (path === "/folders" && method === "POST")
			return { body: this.createFolder(given as { name: string; parentId?: string | null }) };
		const folder = id(/^\/folders\/([^/]+)$/);
		if (folder !== undefined && method === "DELETE") return { body: this.onFolderDelete(folder) };
		if (folder !== undefined && method === "PATCH")
			return { body: this.updateFolder(folder, given as { name?: string; parentId?: string | null }) };
		const media = id(/^\/media\/([^/]+)$/);
		if (media !== undefined && method === "PATCH") return { body: this.updateMedia(media, given as MediaPatch) };
		if (path === "/media/trash" && method === "POST") return { body: this.trash((body?.ids as string[]) ?? []) };
		const replaced = id(/^\/media\/([^/]+)\/replace$/);
		if (replaced !== undefined && method === "POST") return { body: this.replace(replaced) };
		if (path === "/trash/restore" && method === "POST")
			return { body: this.restore((body?.items as TrashTarget[]) ?? []) };
		return undefined;
	}
}
