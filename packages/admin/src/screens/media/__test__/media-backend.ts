import type { FolderListItem } from "@monti-cms/core/site";
import type { MediaItem } from "../../../api/media";

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

/**
 * The media API as the library sees it, over a list of files and folders: the list with its folder, search and filter conditions and the counts the filter
 * menus show, the folders, a move, the trash, a replacement and the restore. A test swaps `onTrash` to make the server keep a file. It keeps the state, so
 * a list read again after a move shows the file in its new place.
 */
export class MediaBackend {
	items: MediaItem[];
	folders: FolderListItem[];
	/** The requests that changed something, in order. */
	writes: { method: string; path: string; body: unknown }[] = [];
	/** The lists asked for, in order. */
	lists: URLSearchParams[] = [];
	onTrash: (ids: string[]) => { trashed: string[]; kept: string[] } = (ids) => ({ trashed: ids, kept: [] });
	onFolderDelete: (id: string) => unknown = () => ({ folder: { id: "x" }, entries: 0, folders: 0, files: 3, kept: 0 });

	constructor(items: MediaItem[], folders: FolderListItem[] = []) {
		this.items = items;
		this.folders = folders;
	}

	private inside(folderId: string, id: string | null): boolean {
		for (let at = id; at; at = this.folders.find((f) => f.id === at)?.parentId ?? null)
			if (at === folderId) return true;
		return false;
	}

	private list(query: URLSearchParams): Answer {
		this.lists.push(query);
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
		const items = base.filter(
			(item) =>
				(kind !== "image" || isImage(item)) &&
				(kind !== "file" || !isImage(item)) &&
				(!alt || (isImage(item) && (alt === "none") === (item.defaultAlt.trim() === ""))),
		);
		const images = base.filter(isImage);
		return {
			body: {
				items,
				total: items.length,
				page: 1,
				pageSize: Number(query.get("pageSize") ?? 25),
				kinds: { image: images.length, file: base.length - images.length },
				alts: {
					none: images.filter((item) => item.defaultAlt.trim() === "").length,
					has: images.filter((item) => item.defaultAlt.trim() !== "").length,
				},
			},
		};
	}

	/** Answers a request of the library, or `undefined` for one that is not the media's (the caller answers those). */
	handle(url: URL, method: string, body?: Record<string, unknown>): Answer | undefined {
		const path = url.pathname.replace("/api/monti/v1", "");
		if (path === "/media" && method === "GET") return this.list(url.searchParams);
		if (path === "/folders" && method === "GET") return { body: this.folders };
		if (path === "/folders" && method === "POST") {
			this.writes.push({ method, path, body });
			const created = folderItem(
				`new-${this.folders.length}`,
				String(body?.name),
				(body?.parentId as string | null) ?? null,
			);
			this.folders = [...this.folders, created];
			return { body: created };
		}
		const folder = path.match(/^\/folders\/([^/]+)$/);
		if (folder && (method === "PATCH" || method === "DELETE")) {
			const id = decodeURIComponent(folder[1] ?? "");
			this.writes.push({ method, path, body });
			if (method === "DELETE") return { body: this.onFolderDelete(id) };
			this.folders = this.folders.map((f) => (f.id === id ? { ...f, ...body, version: f.version + 1 } : f));
			return { body: this.folders.find((f) => f.id === id) };
		}
		const media = path.match(/^\/media\/([^/]+)$/);
		if (media && method === "PATCH") {
			const id = decodeURIComponent(media[1] ?? "");
			this.writes.push({ method, path, body });
			this.items = this.items.map((item) =>
				item.id === id
					? {
							...item,
							...(body?.filename !== undefined ? { filename: String(body.filename) } : {}),
							...(body?.defaultAlt !== undefined ? { defaultAlt: String(body.defaultAlt) } : {}),
							...(body?.defaultCaption !== undefined ? { defaultCaption: String(body.defaultCaption) } : {}),
							...(body && "folderId" in body ? { folderId: body.folderId as string | null } : {}),
						}
					: item,
			);
			return { body: {} };
		}
		if (path === "/media/trash" && method === "POST") {
			this.writes.push({ method, path, body });
			const result = this.onTrash((body?.ids as string[]) ?? []);
			this.items = this.items.filter((item) => !result.trashed.includes(item.id));
			return { body: result };
		}
		const replace = path.match(/^\/media\/([^/]+)\/replace$/);
		if (replace && method === "POST") {
			this.writes.push({ method, path, body });
			return { body: { mediaId: decodeURIComponent(replace[1] ?? "") } };
		}
		if (path === "/trash/restore" && method === "POST") {
			this.writes.push({ method, path, body });
			return {
				body: {
					results: ((body?.items as { type: string; id: string }[]) ?? []).map((item) => ({ ...item, ok: true })),
				},
			};
		}
		return undefined;
	}
}
