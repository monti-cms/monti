import { type Site } from "@monti-cms/core/client";
/** One item of the media list API. */
export interface MediaItem {
    id: string;
    status: "ready" | "deleting" | "pending" | "failed";
    filename: string;
    mimeType: string | null;
    byteSize: number | null;
    width: number | null;
    height: number | null;
    publicUrl: string | null;
    original: {
        mimeType: string | null;
        byteSize: number | null;
        width: number | null;
        height: number | null;
    } | null;
    defaultAlt: string;
    defaultCaption: string;
    createdAt: string;
    referencesCount: number;
    references: {
        entryId: string;
        title: string | null;
        collection: string;
        state: "working" | "published";
    }[];
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
    original?: {
        mimeType: string;
        byteSize: number;
    };
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
export declare const mediaKeys: {
    all: readonly ["cms", "media"];
    lists: () => readonly ["cms", "media", "list"];
    list: (query: string) => readonly ["cms", "media", "list", string];
    detail: (id: string) => readonly ["cms", "media", "detail", string];
};
/** `GET /v1/media/:id` */
export declare const getMedia: (site: Site, id: string, signal?: AbortSignal) => Promise<MediaInfo>;
/** `GET /v1/media?<query>` */
export declare const listMedia: (site: Site, query: string | URLSearchParams, signal?: AbortSignal) => Promise<MediaPage>;
/** `PATCH /v1/media/:id`: renames the file, or sets its default description. */
export declare const updateMedia: (site: Site, id: string, patch: {
    filename: string;
} | {
    defaultAlt: string;
    defaultCaption: string;
}, fallback?: string) => Promise<void>;
/** `DELETE /v1/media/:id` */
export declare const deleteMedia: (site: Site, id: string, fallback?: string) => Promise<void>;
/** `POST /v1/media/cleanup`: removes the files that are stuck deleting. */
export declare const cleanupMedia: (site: Site) => Promise<{
    removed: number;
    failed: string[];
}>;
/** `POST /v1/media/uploads`: asks the server to prepare an upload. */
export declare const requestUpload: (site: Site, body: UploadRequest, fallback: string) => Promise<UploadPlan>;
/** `POST /v1/media/:id/complete`: the bytes are in storage, the server inspects them and marks the media ready. */
export declare const completeUpload: (site: Site, id: string, fallback: string) => Promise<UploadCompletion>;
