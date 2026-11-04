"use client";

import { useCmsMutation, useTranslator } from "@monti-cms/admin";
import { ListSection, ListSectionRow, MenuField, ModelMenu, useApiKeys } from "@monti-cms/admin/kit";
import { useEffect, useState } from "react";
import { agentPanelMessages } from "./agent-panel.messages";
import { aiKeys, setAiQuickModel } from "./api";
import { modelValue, parseModelValue } from "./model-groups";
import { useAiSettings, useKeyModels } from "./use-ai-settings";

/**
 * The Models section of Tools › API keys (flow 10 · 13): the quick-task model, used for the summary, tags, alt text and translation fill. Its menu is the chat
 * input's, grouped by key, without recent models or a thinking level, and a pick applies at once. Keys whose service has no default model (an
 * OpenAI-compatible server) start with none chosen.
 */
export function ModelSection() {
	const t = useTranslator(agentPanelMessages);
	const settingsQuery = useAiSettings();
	const settings = settingsQuery.data;
	// A key added, changed or deleted on this page changes the AI keys and the default model: read them again.
	const keysRead = useApiKeys().dataUpdatedAt;
	const { refetch } = settingsQuery;
	useEffect(() => {
		if (keysRead) void refetch();
	}, [keysRead, refetch]);
	const [open, setOpen] = useState(false);
	const keys = settings?.keys ?? [];
	const lists = useKeyModels(keys, open);
	const save = useCmsMutation({
		fn: (quick: { keyId: string; model: string }, { site }) =>
			setAiQuickModel(site, { expectedVersion: settings?.version ?? 0, quick }, t("quick.failed")),
		success: t("quick.saved"),
		failure: t("quick.failed"),
		invalidate: [aiKeys.settings(), ["cms", "api-keys"]],
	});
	if (!settings) return null;
	const quick = settings.quick;
	const labelId = "model-quick";
	return (
		<ListSection title={t("models.title")}>
			<ListSectionRow
				title={t("quick.title")}
				meta={t("quick.uses")}
				labelId={labelId}
				control={
					keys.length > 0 ? (
						<ModelMenu
							layout="field"
							open={open}
							onOpenChange={setOpen}
							value={quick ? modelValue(quick) : null}
							onValueChange={(value) => save.mutate(parseModelValue(value))}
							searchLabel={t("menu.search")}
							emptyText={lists.some((list) => list.loading) ? t("menu.loading") : t("menu.empty")}
							groups={lists.map(({ key, models }) => ({
								key: key.id,
								label: key.name,
								count: models.length,
								items: (quick && key.id === quick.keyId && !models.includes(quick.model)
									? [quick.model, ...models]
									: models
								).map((model) => ({ value: modelValue({ keyId: key.id, model }), model })),
							}))}
							trigger={
								<MenuField
									aria-labelledby={labelId}
									mono
									value={quick?.model}
									meta={quick?.keyName}
									placeholder={t("quick.pick")}
								/>
							}
						/>
					) : (
						<MenuField aria-labelledby={labelId} placeholder={t("quick.noKey")} disabled />
					)
				}
			/>
		</ListSection>
	);
}
