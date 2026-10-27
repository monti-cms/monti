"use client";

import { useCmsMutation, useTranslator } from "@monti-cms/admin";
import {
	Box,
	Button,
	commonMessages,
	FormField,
	FormFieldLabel,
	Grid,
	Heading,
	Inline,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/admin/kit";
import { useState } from "react";
import type { AiProviderView, AiSettingsView } from "../connection";
import { agentPanelMessages } from "./agent-panel.messages";
import { setAiAgentModel } from "./api";
import { OptionSelect } from "./custom-editor";
import { ModelCombobox, useModelList } from "./model-combobox";

/** The value of the connection select that means "no choice": the first ready connection with its default model. */
const DEFAULT_CONNECTION = "";

/**
 * The connection and model the assistant runs on, on the Connections tab of the AI screen. Each model shows what the connection check found out about its
 * tool calling, because the assistant is off for a model that can't call tools. Saved with the whole settings version, like a connection.
 */
export function AgentModelPicker({
	settings,
	onSaved,
	onConflict,
}: {
	settings: AiSettingsView;
	onSaved: (saved: AiSettingsView) => void;
	onConflict: () => void;
}) {
	const t = useTranslator(agentPanelMessages);
	const tc = useTranslator(commonMessages);
	const chosen = settings.agent.setting;
	const chatConnections = settings.providers.filter((provider) => provider.kind === "chat");
	const [providerId, setProviderId] = useState(chosen?.providerId ?? DEFAULT_CONNECTION);
	const [model, setModel] = useState(chosen?.model ?? "");
	const provider: AiProviderView | undefined = chatConnections.find((item) => item.id === providerId);
	const list = useModelList(provider ? { providerId: provider.id } : null);

	// The models the connection lists, and those the check tried even if the list cannot be read.
	const checked = provider ? Object.keys(provider.toolSupport) : [];
	const models = provider
		? [
				...(list.models ?? []),
				...checked.filter((id) => !list.models?.some((item) => item.id === id)).map((id) => ({ id })),
			]
		: [];
	const hints = Object.fromEntries(
		Object.entries(provider?.toolSupport ?? {}).map(([id, tools]) => [
			id,
			tools ? t("picker.hint.yes") : t("picker.hint.no"),
		]),
	);
	const tools = provider && model ? provider.toolSupport[model] : undefined;

	const dirty =
		providerId !== (chosen?.providerId ?? DEFAULT_CONNECTION) ||
		(providerId !== DEFAULT_CONNECTION && model !== chosen?.model);
	const save = useCmsMutation({
		fn: (_: undefined, { site: current }) =>
			setAiAgentModel(
				current,
				{
					expectedVersion: settings.version,
					agent: provider && model ? { providerId: provider.id, model } : null,
				},
				t("picker.saveFailed"),
			),
		success: tc("saved"),
		failure: t("picker.saveFailed"),
		onSuccess: onSaved,
		onError: onConflict,
	});

	if (chatConnections.length === 0) return null;
	return (
		<Box border="bottom" paddingX={16} paddingY={12} shrink={false}>
			<Stack gap={8}>
				<Heading as="h2" variant="label">
					{t("picker.title")}
				</Heading>
				<Grid gap={16} columns={2}>
					<FormField>
						<FormFieldLabel htmlFor="agent-connection">{t("picker.connection")}</FormFieldLabel>
						<OptionSelect
							id="agent-connection"
							value={providerId}
							options={[
								{ value: DEFAULT_CONNECTION, label: t("picker.default") },
								...chatConnections.map((item) => ({ value: item.id, label: item.name })),
							]}
							onChange={(next) => {
								setProviderId(next);
								setModel(chatConnections.find((item) => item.id === next)?.defaultModel ?? "");
							}}
						/>
					</FormField>
					<FormField>
						<FormFieldLabel htmlFor="agent-model">{t("picker.model")}</FormFieldLabel>
						{provider ? (
							<ModelCombobox
								id="agent-model"
								value={model}
								onChange={setModel}
								models={models}
								loading={list.loading}
								error={list.error}
								hints={hints}
							/>
						) : (
							<Text variant="caption" tone="muted">
								{settings.agent.effective
									? `${settings.agent.effective.model} · ${settings.agent.effective.providerName}`
									: ""}
							</Text>
						)}
					</FormField>
				</Grid>
				<Inline gap={8} justify="between">
					<Text variant="caption" tone={tools === false ? "danger" : "muted"}>
						{provider && model
							? t(tools === undefined ? "picker.tools.unknown" : tools ? "picker.tools.yes" : "picker.tools.no")
							: ""}
					</Text>
					<Inline gap={8}>
						{chosen && (
							<TextButton
								type="button"
								onClick={() => {
									setProviderId(DEFAULT_CONNECTION);
									setModel("");
								}}
							>
								{t("picker.reset")}
							</TextButton>
						)}
						<Button type="button" size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(undefined)}>
							{t("picker.save")}
						</Button>
					</Inline>
				</Inline>
			</Stack>
		</Box>
	);
}
