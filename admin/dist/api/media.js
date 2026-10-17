import { adminFetch } from "./client.js";
/** Query keys. Everything under `all` is refetched after a write; `lists` holds only the paged lists (what an optimistic change rewrites). */
export const mediaKeys = {
    all: ["cms", "media"],
    lists: () => [...mediaKeys.all, "list"],
    list: (query) => [...mediaKeys.lists(), query],
    detail: (id) => [...mediaKeys.all, "detail", id],
};
const mediaUrl = (id) => `/v1/media/${encodeURIComponent(id)}`;
/** `GET /v1/media/:id` */
export const getMedia = (site, id, signal) => adminFetch(site, mediaUrl(id), { signal });
/** `GET /v1/media?<query>` */
export const listMedia = (site, query, signal) => adminFetch(site, `/v1/media?${query.toString()}`, { signal });
/** `PATCH /v1/media/:id`: renames the file, sets default description, or moves to a folder. */
export const updateMedia = (site, id, patch, fallback) => adminFetch(site, mediaUrl(id), { method: "PATCH", json: patch, fallback });
/** `DELETE /v1/media/:id` */
export const deleteMedia = (site, id, fallback) => adminFetch(site, mediaUrl(id), { method: "DELETE", fallback });
/** `POST /v1/media/cleanup`: removes the files that are stuck deleting. */
export const cleanupMedia = (site) => adminFetch(site, "/v1/media/cleanup", {
    method: "POST",
    json: {},
});
/** `POST /v1/media/uploads`: asks the server to prepare an upload. */
export const requestUpload = (site, body, fallback) => adminFetch(site, "/v1/media/uploads", { method: "POST", json: body, fallback });
/** `POST /v1/media/:id/complete`: the bytes are in storage, the server inspects them and marks the media ready. */
export const completeUpload = (site, id, fallback) => adminFetch(site, `/v1/media/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    json: {},
    fallback,
});
