import { adminApiUrl, type PreferencesBody, type Site } from "@monti-cms/core/site";
import { adminFetch } from "./client";

export const preferencesKeys = {
	all: ["cms", "preferences"] as const,
};

/** `GET /v1/preferences` (the signed-in user's saved list settings). */
export const getPreferences = (site: Site, signal?: AbortSignal) =>
	adminFetch<PreferencesBody>(site, adminApiUrl("/v1/preferences"), { signal });

/** `PUT /v1/preferences` (only the given part changes). */
export const savePreferences = (site: Site, body: PreferencesBody) =>
	adminFetch(site, adminApiUrl("/v1/preferences"), { method: "PUT", json: body });
