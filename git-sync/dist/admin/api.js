import { adminFetch } from "@monti-cms/admin";
export const gitSyncKeys = {
    all: ["cms", "git-sync"],
    status: () => [...gitSyncKeys.all, "status"],
    conflicts: () => [...gitSyncKeys.all, "conflicts"],
};
/** `GET /v1/git-sync/status` */
export const getGitSyncStatus = (site, options = {}) => adminFetch(site, "/v1/git-sync/status", options);
/** `GET /v1/git-sync/conflicts` */
export const listGitSyncConflicts = (site, options = {}) => adminFetch(site, "/v1/git-sync/conflicts", options);
/** `POST /v1/git-sync/pull` */
export const pullGitSync = (site, target, fallback) => adminFetch(site, "/v1/git-sync/pull", {
    method: "POST",
    json: { target },
    fallback,
});
/** `POST /v1/git-sync/flush` */
export const flushGitSync = (site, target, fallback) => adminFetch(site, "/v1/git-sync/flush", {
    method: "POST",
    json: { target },
    fallback,
});
/** `POST /v1/git-sync/conflicts/resolve` */
export const resolveGitSyncConflict = (site, conflict, resolution, fallback) => adminFetch(site, "/v1/git-sync/conflicts/resolve", {
    method: "POST",
    json: { target: conflict.target, entryId: conflict.entryId, resolution, gitSha: conflict.gitSha },
    fallback,
});
/** `PUT /v1/api-keys/slots`: assigns an API key to one of the plugin's slots. */
export const assignGitSyncKey = (site, values, fallback) => adminFetch(site, "/v1/api-keys/slots", {
    method: "PUT",
    json: { plugin: "git-sync", ...values },
    fallback,
});
