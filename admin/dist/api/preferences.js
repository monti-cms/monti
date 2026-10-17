import { adminFetch } from "./client.js";
export const preferencesKeys = {
    all: ["cms", "preferences"],
};
/** `GET /v1/preferences` (the signed-in user's saved list settings). */
export const getPreferences = (site, signal) => adminFetch(site, "/v1/preferences", { signal });
/** `PUT /v1/preferences` (only the given part changes). */
export const savePreferences = (site, body) => adminFetch(site, "/v1/preferences", { method: "PUT", json: body });
