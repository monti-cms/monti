import { type ApiKeyList, type Site } from "@monti-cms/core/site";
/** Query keys. Everything under `all` is refetched after a key is added, renamed, replaced or deleted. */
export declare const apiKeysKeys: {
    all: readonly ["cms", "api-keys"];
    list: () => readonly ["cms", "api-keys", "list"];
};
/** The saved keys (names, masked tails, the places that use them) — never their values. */
export declare const listApiKeys: (site: Site, signal?: AbortSignal, fallback?: string) => Promise<ApiKeyList>;
export declare const createApiKey: (site: Site, input: {
    name: string;
    value: string;
}, fallback?: string) => Promise<unknown>;
/** Renames a key (`name`) or replaces its value (`value`). */
export declare const updateApiKey: (site: Site, id: string, input: {
    expectedVersion: number;
} & ({
    name: string;
} | {
    value: string;
}), fallback?: string) => Promise<unknown>;
/** Deletes a key. `force` also deletes it while something still uses it. */
export declare const deleteApiKey: (site: Site, key: {
    id: string;
    version: number;
}, options?: {
    force?: boolean;
    fallback?: string;
}) => Promise<unknown>;
/** Assigns a key to a plugin slot, or clears it (`{ use: "none" }`). A typed key is saved in the same request. */
export declare const putApiKeySlot: (site: Site, plugin: string, slot: string, key: unknown, fallback?: string) => Promise<unknown>;
/** The saved keys, cached for 30 seconds. */
export declare function useApiKeys(): import("@tanstack/react-query").UseQueryResult<ApiKeyList, Error>;
