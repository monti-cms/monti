import { type ApiKeyList, type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import { apiKeysMessages } from "../screens/api-keys/messages";
import { adminFetch } from "./client";

/** Query keys. Everything under `all` is refetched after a key is added, renamed, replaced or deleted. */
export const apiKeysKeys = {
	all: ["cms", "api-keys"] as const,
	list: () => [...apiKeysKeys.all, "list"] as const,
};

/** The saved keys (names, masked tails, the places that use them) — never their values. */
export const listApiKeys = (site: Site, signal?: AbortSignal, fallback?: string) =>
	adminFetch<ApiKeyList>(site, "/v1/api-keys", { signal, fallback });

export const createApiKey = (site: Site, input: { name: string; value: string }, fallback?: string) =>
	adminFetch(site, "/v1/api-keys", { method: "POST", json: input, fallback });

/** Renames a key (`name`) or replaces its value (`value`). */
export const updateApiKey = (
	site: Site,
	id: string,
	input: { expectedVersion: number } & ({ name: string } | { value: string }),
	fallback?: string,
) => adminFetch(site, `/v1/api-keys/${encodeURIComponent(id)}`, { method: "PATCH", json: input, fallback });

/** Deletes a key. `force` also deletes it while something still uses it. */
export const deleteApiKey = (
	site: Site,
	key: { id: string; version: number },
	options: { force?: boolean; fallback?: string } = {},
) => {
	const query = new URLSearchParams({ expectedVersion: String(key.version) });
	if (options.force) query.set("force", "true");
	return adminFetch(site, `/v1/api-keys/${encodeURIComponent(key.id)}?${query}`, {
		method: "DELETE",
		fallback: options.fallback,
	});
};

/** Assigns a key to a plugin slot, or clears it (`{ use: "none" }`). A typed key is saved in the same request. */
export const putApiKeySlot = (site: Site, plugin: string, slot: string, key: unknown, fallback?: string) =>
	adminFetch(site, "/v1/api-keys/slots", { method: "PUT", json: { plugin, slot, key }, fallback });

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
