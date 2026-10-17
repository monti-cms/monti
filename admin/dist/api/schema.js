import { adminFetch } from "./client.js";
/** The calls of the schema settings screen (see the `/v1/schema` routes of the admin API). */
/** Query keys. */
export const schemaKeys = {
    all: ["cms", "schema"],
    state: () => [...schemaKeys.all, "state"],
};
/** The schema file as the screen edits it. */
export const fetchSchema = (site, signal) => adminFetch(site, "/v1/schema", { signal });
export const previewSchema = (site, request, signal) => adminFetch(site, "/v1/schema/preview", { method: "POST", json: request, signal });
/**
 * Saves an edit. `acknowledged` names the impacts of the preview the writer saw: the server refuses a save whose changes leave stored entries worse off
 * unless their keys are here (`schema_unacknowledged`).
 */
export const saveSchema = (site, request) => adminFetch(site, "/v1/schema", {
    method: "PUT",
    json: request,
});
