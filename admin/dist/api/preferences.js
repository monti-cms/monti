import { cmsApiUrl } from "@monti-cms/core/client";
import { cmsFetch } from "./client.js";
export const preferencesKeys = {
    all: ["cms", "preferences"],
};
/** `GET /v1/preferences` (the signed-in user's saved list settings). */
export const getPreferences = (site, signal) => cmsFetch(site, cmsApiUrl("/v1/preferences"), { signal });
/** `PUT /v1/preferences` (only the given part changes). */
export const savePreferences = (site, body) => cmsFetch(site, cmsApiUrl("/v1/preferences"), { method: "PUT", json: body });
