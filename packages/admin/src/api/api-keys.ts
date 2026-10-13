import { type ApiKeyList, cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { cmsFetch } from "../admin-api";
import { apiKeysMessages } from "./messages";

/** Everything under this prefix is refetched after a key is added, renamed, replaced or deleted. */
export const API_KEYS_KEY = ["cms", "api-keys"] as const;

/** The saved keys (names, masked tails, the places that use them) — never their values. */
export function useApiKeys() {
	const site = useSite();
	const t = useTranslator(apiKeysMessages);
	return useQuery({
		queryKey: API_KEYS_KEY,
		queryFn: ({ signal }) =>
			cmsFetch<ApiKeyList>(site, cmsApiUrl("/v1/api-keys"), { signal, fallback: t("load.failed") }),
		staleTime: 30_000,
	});
}
