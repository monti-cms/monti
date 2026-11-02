"use client";

import { useSite, useTranslator } from "@monti-cms/admin";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { AiKeyView } from "../connection";
import { agentPanelMessages } from "./agent-panel.messages";
import { aiKeys, getAiSettings, listAiModels } from "./api";

/** The keys of AI services, the quick-task model and the default model of a new conversation (`GET /v1/ai/settings`). */
export function useAiSettings() {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	return useQuery({
		queryKey: aiKeys.settings(),
		queryFn: ({ signal }) => getAiSettings(site, { signal, fallback: t("settings.failed") }),
		staleTime: 30_000,
	});
}

/** The models of each readable key, fetched once each while `enabled` (a menu opened). A key whose list fails has none. */
export function useKeyModels(keys: readonly AiKeyView[], enabled: boolean) {
	const site = useSite();
	return useQueries({
		queries: keys.map((key) => ({
			queryKey: aiKeys.models(key.id),
			queryFn: ({ signal }: { signal: AbortSignal }) => listAiModels(site, key.id, { signal }),
			enabled: enabled && key.ready,
			staleTime: 5 * 60_000,
		})),
	}).map((query, index) => ({
		key: keys[index] as AiKeyView,
		models: query.data?.items.map((item) => item.id) ?? [],
		loading: query.isPending && enabled,
	}));
}
