"use client";

import { useTranslator } from "@monti-cms/admin";
import { ModelMenu, ModelMenuButton, type ModelMenuGroup, usePreference } from "@monti-cms/admin/kit";
import { useState } from "react";
import type { AgentModelChoice, AiModelChoice, AiSettingsView } from "../connection";
import { canThink, THINKING_LEVELS, type ThinkingLevel } from "../service-models";
import { agentPanelMessages } from "./agent-panel.messages";
import { liveRecent, modelValue, parseModelValue, withRecent } from "./model-groups";
import { useKeyModels } from "./use-ai-settings";

const RECENT_CODEC = {
	parse: (raw: string): AiModelChoice[] => {
		try {
			const parsed = JSON.parse(raw) as unknown;
			return Array.isArray(parsed) ? (parsed as AiModelChoice[]) : [];
		} catch {
			return [];
		}
	},
	serialize: (value: AiModelChoice[]) => JSON.stringify(value),
};

/** The level a model that thinks starts at. */
export const DEFAULT_THINKING: ThinkingLevel = "medium";

/** Whether the model of a choice can think, from the service of its key. */
export function thinks(settings: AiSettingsView, choice: AiModelChoice): boolean {
	const key = settings.keys.find((entry) => entry.id === choice.keyId);
	return key ? canThink(key.service, choice.model) : false;
}

/**
 * The model button at the start of the chat input (flow 2 · 23): the model of this conversation and, for a model that thinks, its level. Its menu has a
 * search line, the recent models (the default first, marked default), then the models of each key with its count; a model a run found unable to use
 * tools is left out. "Thinking ›" opens the levels. Picking applies to this conversation only.
 */
export function AgentModelPicker({
	settings,
	value,
	onChange,
	open: openProp,
	onOpenChange,
}: {
	settings: AiSettingsView;
	/** `null` while no model is chosen and there is no default (only keys without a default model). */
	value: AgentModelChoice | null;
	onChange: (next: AgentModelChoice) => void;
	/** Opens the menu from outside ("Send with another model"). */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const t = useTranslator(agentPanelMessages);
	const [ownOpen, setOwnOpen] = useState(false);
	const open = openProp ?? ownOpen;
	const setOpen = onOpenChange ?? setOwnOpen;
	const [stored, setRecent] = usePreference("agent-recent-models", RECENT_CODEC, []);
	const lists = useKeyModels(settings.keys, open);
	const keyName = (keyId: string) => settings.keys.find((key) => key.id === keyId)?.name ?? "";
	// A model a run found unable to use tools cannot run the assistant, so it is not offered.
	const usable = (choice: AiModelChoice) => settings.toolSupport[choice.keyId]?.[choice.model] !== false;

	const fallback = settings.assistant;
	const recent: AiModelChoice[] = [
		...(fallback ? [{ keyId: fallback.keyId, model: fallback.model }] : []),
		...liveRecent(stored, settings.keys).filter(
			(entry) => usable(entry) && (!fallback || modelValue(entry) !== modelValue(fallback)),
		),
	];
	const inRecent = new Set(recent.map(modelValue));
	const groups: ModelMenuGroup[] = [
		{
			key: "recent",
			label: t("menu.recent"),
			items: recent.map((entry, index) => ({
				value: modelValue(entry),
				model: entry.model,
				hint: index === 0 && fallback ? t("menu.default") : keyName(entry.keyId),
			})),
		},
		...lists.map(({ key, models }) => ({
			key: key.id,
			label: key.name,
			count: models.length,
			items: models
				.map((model) => ({ keyId: key.id, model }))
				.filter((choice) => usable(choice) && !inRecent.has(modelValue(choice)))
				.map((choice) => ({ value: modelValue(choice), model: choice.model })),
		})),
	];
	const thinking = value !== null && thinks(settings, value);
	const levelLabel = (level: ThinkingLevel) => t(`thinking.${level}`);
	return (
		<ModelMenu
			open={open}
			onOpenChange={setOpen}
			value={value ? modelValue(value) : null}
			onValueChange={(picked) => {
				const choice = parseModelValue(picked);
				setRecent(withRecent(stored, choice));
				const level = value && value.thinking !== "off" ? value.thinking : DEFAULT_THINKING;
				onChange({ ...choice, thinking: thinks(settings, choice) ? level : "off" });
			}}
			groups={groups}
			searchLabel={t("menu.search")}
			emptyText={lists.some((list) => list.loading) ? t("menu.loading") : t("menu.empty")}
			{...(thinking && value
				? {
						thinking: {
							label: t("thinking.label"),
							value: value.thinking,
							options: THINKING_LEVELS.map((level) => ({ value: level, label: levelLabel(level) })),
							onValueChange: (level: string) => onChange({ ...value, thinking: level as ThinkingLevel }),
						},
					}
				: {})}
			trigger={
				<ModelMenuButton
					label={t("menu.label")}
					model={value?.model ?? t("menu.label")}
					{...(thinking && value && value.thinking !== "off"
						? { thinking: t("thinking.button", { level: levelLabel(value.thinking) }) }
						: {})}
				/>
			}
		/>
	);
}
