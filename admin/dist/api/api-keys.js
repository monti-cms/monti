import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { apiKeysMessages } from "../screens/api-keys/messages.js";
import { cmsFetch } from "./client.js";
/** Query keys. Everything under `all` is refetched after a key is added, renamed, replaced or deleted. */
export const apiKeysKeys = {
    all: ["cms", "api-keys"],
    list: () => [...apiKeysKeys.all, "list"],
};
/** The saved keys (names, masked tails, the places that use them) — never their values. */
export const listApiKeys = (site, signal, fallback) => cmsFetch(site, cmsApiUrl("/v1/api-keys"), { signal, fallback });
export const createApiKey = (site, input, fallback) => cmsFetch(site, cmsApiUrl("/v1/api-keys"), { method: "POST", json: input, fallback });
/** Renames a key (`name`) or replaces its value (`value`). */
export const updateApiKey = (site, id, input, fallback) => cmsFetch(site, cmsApiUrl(`/v1/api-keys/${encodeURIComponent(id)}`), { method: "PATCH", json: input, fallback });
/** Deletes a key. `force` also deletes it while something still uses it. */
export const deleteApiKey = (site, key, options = {}) => {
    const query = new URLSearchParams({ expectedVersion: String(key.version) });
    if (options.force)
        query.set("force", "true");
    return cmsFetch(site, cmsApiUrl(`/v1/api-keys/${encodeURIComponent(key.id)}?${query}`), {
        method: "DELETE",
        fallback: options.fallback,
    });
};
/** Assigns a key to a plugin slot, or clears it (`{ use: "none" }`). A typed key is saved in the same request. */
export const putApiKeySlot = (site, plugin, slot, key, fallback) => cmsFetch(site, cmsApiUrl("/v1/api-keys/slots"), { method: "PUT", json: { plugin, slot, key }, fallback });
/** The saved keys, cached for 30 seconds. */
export function useApiKeys() {
    const site = useSite();
    const t = useTranslator(apiKeysMessages);
    return useQuery({
        queryKey: apiKeysKeys.list(),
        queryFn: ({ signal }) => listApiKeys(site, signal, t("load.failed")),
        staleTime: 30_000,
    });
}
