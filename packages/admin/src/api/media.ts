import type { Site } from "@monti-cms/core/site";
import { adminFetch } from "./client";

/** One item of the media list API. */
export interface MediaItem {
	id: string;
	folderId?: string | null;
	status: "ready" | "deleting" | "pending" | "failed";
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	publicUrl: string | null;
	original: { mimeType: string | null; byteSize: number | null; width: number | null; height: number | null } | null;
	defaultAlt: string;
	defaultCaption: string;
	createdAt: string;
	referencesCount: number;
	references: { entryId: string; title: string | null; collection: string; state: "working" | "published" }[];
}

/** One page of the media list API. */
export interface MediaPage {
	items: MediaItem[];
	total: number;
}

/** What `GET /v1/media/:id` answers, as far as the editor needs it (a file card, an image that is not stored in the document). */
export interface MediaInfo {
	filename: string;
	byteSize: number | null;
	mimeType: string | null;
	status?: string;
	publicUrl?: string | null;
	folderId?: string | null;
}

/** Where to PUT the bytes of one file, as the server prepares it. */
export interface UploadTicket {
	uploadUrl: string;
	requiredHeaders?: Record<string, string>;
}

/** What `POST /v1/media/uploads` asks: the public file, and the original when the browser optimized the image. */
export interface UploadRequest {
	filename: string;
	mimeType: string;
	byteSize: number;
	original?: { mimeType: string; byteSize: number };
	folderId?: string | null;
}

export interface UploadPlan extends UploadTicket {
	mediaId: string;
	original?: UploadTicket;
}

/** What `POST /v1/media/:id/complete` answers once the server has inspected the bytes. */
export interface UploadCompletion {
	mediaId: string;
	publicUrl?: string | null;
	width: number;
	height: number;
	defaultAlt?: string;
	defaultCaption?: string;
}

/** Query keys. Everything under `all` is refetched after a write; `lists` holds only the paged lists (what an optimistic change rewrites). */
export const mediaKeys = {
	all: ["cms", "media"] as const,
	lists: () => [...mediaKeys.all, "list"] as const,
	list: (query: string) => [...mediaKeys.lists(), query] as const,
	detail: (id: string) => [...mediaKeys.all, "detail", id] as const,
};

const mediaUrl = (id: string) => `/v1/media/${encodeURIComponent(id)}`;

/** `GET /v1/media/:id` */
export const getMedia = (site: Site, id: string, signal?: AbortSignal) =>
	adminFetch<MediaInfo>(site, mediaUrl(id), { signal });

/** `GET /v1/media?<query>` */
export const listMedia = (site: Site, query: string | URLSearchParams, signal?: AbortSignal) =>
	adminFetch<MediaPage>(site, `/v1/media?${query.toString()}`, { signal });

/** `PATCH /v1/media/:id`: renames the file, sets default description, or moves to a folder. */
export const updateMedia = (
	site: Site,
	id: string,
	patch: { filename?: string; defaultAlt?: string; defaultCaption?: string; folderId?: string | null },
	fallback?: string,
) => adminFetch<void>(site, mediaUrl(id), { method: "PATCH", json: patch, fallback });

/** `DELETE /v1/media/:id` */
export const deleteMedia = (site: Site, id: string, fallback?: string) =>
	adminFetch<void>(site, mediaUrl(id), { method: "DELETE", fallback });

/** `POST /v1/media/cleanup`: removes the files that are stuck deleting. */
export const cleanupMedia = (site: Site) =>
	adminFetch<{ removed: number; failed: string[] }>(site, "/v1/media/cleanup", {
		method: "POST",
		json: {},
	});

/** `POST /v1/media/uploads`: asks the server to prepare an upload. */
export const requestUpload = (site: Site, body: UploadRequest, fallback: string) =>
	adminFetch<UploadPlan>(site, "/v1/media/uploads", { method: "POST", json: body, fallback });

/** `POST /v1/media/:id/complete`: the bytes are in storage, the server inspects them and marks the media ready. */
export const completeUpload = (site: Site, id: string, fallback: string) =>
	adminFetch<UploadCompletion>(site, `/v1/media/${encodeURIComponent(id)}/complete`, {
		method: "POST",
		json: {},
		fallback,
	});
