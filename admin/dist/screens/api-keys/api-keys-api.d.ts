import { type ApiKeyList } from "@monti-cms/core/client";
/** Everything under this prefix is refetched after a key is added, renamed, replaced or deleted. */
export declare const API_KEYS_KEY: readonly ["cms", "api-keys"];
/** The saved keys (names, masked tails, the places that use them) — never their values. */
export declare function useApiKeys(): import("@tanstack/react-query").UseQueryResult<ApiKeyList, Error>;
