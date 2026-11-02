"use client";

import { Add, RecentlyViewed } from "@carbon/icons-react";
import {
	type AdminPanel,
	type AdminPanelProps,
	errorText,
	type Site,
	useScreenContext,
	useSite,
	useTranslator,
} from "@monti-cms/admin";
import {
	Box,
	Button,
	ChatError,
	ChatInput,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	EmptyState,
	IconButton,
	SidePanel,
	Spark,
	Stack,
	Text,
	TextButton,
	usePreference,
} from "@monti-cms/admin/kit";
import { AdminLink } from "@monti-cms/admin/router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { type AgentModelChoice, type AiSettingsView, CREDIT_EXHAUSTED } from "../connection";
import { serviceName } from "../service-models";
import { MessageView } from "./agent-conversation";
import { AgentModelPicker, DEFAULT_THINKING, thinks } from "./agent-model-picker";
import { agentPanelMessages } from "./agent-panel.messages";
import { aiKeys, getAgentRun, listAgentRuns } from "./api";
import { useAgentChat } from "./use-agent-chat";
import { useAiSettings } from "./use-ai-settings";

/** Tools › API keys, where a key of an AI service is added. */
const KEYS_SCREEN = "/tools/api-keys";

/** The id of the open conversation, as the preference holds it (empty: none). */
const RUN_CODEC = { parse: (raw: string) => raw, serialize: (value: string) => value };

/** The model a new conversation starts with: the built-in default, thinking at the default level when it can. `null` when there is none. */
function defaultModel(settings: AiSettingsView | undefined): AgentModelChoice | null {
	const fallback = settings?.assistant;
	if (!settings || !fallback) return null;
	const choice = { keyId: fallback.keyId, model: fallback.model };
	return { ...choice, thinking: thinks(settings, choice) ? DEFAULT_THINKING : "off" };
}

/** No key of an AI service yet (flow 2 · 22): the panel says so and sends the admin to the API keys. */
function NoKey() {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	return (
		<Stack gap={16} grow justify="center" paddingX={32} paddingY={24} data-testid="agent-no-key">
			<Text as="p" variant="title">
				{t("noKey.title")}
			</Text>
			<Text as="p" variant="note" tone="muted">
				{t("noKey.text")}
			</Text>
			<Box>
				<Button render={<AdminLink href={site.adminHref(KEYS_SCREEN)} />}>{t("noKey.action")}</Button>
			</Box>
		</Stack>
	);
}

/** The past conversations of this admin, newest first; picking one opens it. */
function HistoryMenu({ onPick }: { onPick: (id: string) => void }) {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	const [open, setOpen] = useState(false);
	const runs = useQuery({
		queryKey: aiKeys.agentRuns(),
		queryFn: ({ signal }) => listAgentRuns(site, { signal, fallback: t("history.failed") }),
		enabled: open,
		// Read each time the menu opens: a conversation just had is the newest of the list.
		staleTime: 0,
	});
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<IconButton
				label={t("history.label")}
				side="bottom"
				trigger={(button) => <DropdownMenuTrigger render={button} />}
			>
				<RecentlyViewed aria-hidden />
			</IconButton>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{t("history.label")}</DropdownMenuLabel>
					{runs.isPending && <DropdownMenuItem disabled>{t("history.loading")}</DropdownMenuItem>}
					{runs.error && (
						<DropdownMenuItem disabled>{errorText(site, runs.error, t("history.failed"))}</DropdownMenuItem>
					)}
					{runs.data?.items.length === 0 && <DropdownMenuItem disabled>{t("history.empty")}</DropdownMenuItem>}
					{runs.data?.items.map((run) => (
						<DropdownMenuItem key={run.id} onClick={() => onPick(run.id)}>
							{run.title || t("history.untitled")}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The assistant, as the admin's side panel: the conversation with its tool calls, the box to ask in, the model it runs on and what the conversation has
 * used. It knows where the admin is (`useScreenContext`), and on the entry editor it reads the open entry through the editor tools.
 */
export function AgentPanel({ onClose }: AdminPanelProps) {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	const screen = useScreenContext();
	const settings = useAiSettings().data;
	// The model of this conversation: picked in the chat input, or the built-in default (`null` until one is picked).
	const [picked, setPicked] = useState<AgentModelChoice | null>(null);
	const model = picked ?? defaultModel(settings);
	const chat = useAgentChat(picked);
	const [pickerOpen, setPickerOpen] = useState(false);
	// "Send with another model": the next pick sends the refused request again on that model.
	const resendOnPick = useRef(false);
	const chatRef = useRef(chat);
	chatRef.current = chat;
	const [text, setText] = useState("");
	const [openError, setOpenError] = useState<string | null>(null);
	// Every screen mounts the panel again: the open conversation is remembered in this browser and picked up where the admin left it.
	const [rememberedRun, rememberRun] = usePreference("agent-run", RUN_CODEC, "");
	const endRef = useRef<HTMLDivElement>(null);
	const busy = chat.status === "submitted" || chat.status === "streaming";
	const noKey = settings !== undefined && !settings.fake && settings.keys.length === 0;
	const credit = chat.error?.message === CREDIT_EXHAUSTED;
	const creditKey = credit && model ? settings?.keys.find((key) => key.id === model.keyId) : undefined;

	// Keep the newest part in view while the answer streams.
	// biome-ignore lint/correctness/useExhaustiveDependencies: scrolls whenever the messages change
	useEffect(() => {
		endRef.current?.scrollIntoView?.({ block: "end" });
	}, [chat.messages]);

	const { runId } = chat;
	useEffect(() => {
		if (runId) rememberRun(runId);
	}, [runId, rememberRun]);

	const send = (message: string) => {
		if (busy || noKey) return;
		setText("");
		setOpenError(null);
		void chat.sendMessage({ text: message });
	};
	const open = async (id: string, restoring = false) => {
		setOpenError(null);
		try {
			const run = await getAgentRun(site, id, { fallback: t("run.openFailed") });
			// The admin may have started typing while a remembered conversation loaded: theirs wins.
			if (restoring && chatRef.current.messages.length > 0) return;
			chat.reopen(id, run.messages);
			setPicked(run.model ?? null);
		} catch (error) {
			// A conversation that is gone is forgotten; one the admin picked says it could not be opened.
			if (restoring) rememberRun("");
			else setOpenError(errorText(site, error, t("run.openFailed")));
		}
	};
	const restored = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: restores once, when the panel appears
	useEffect(() => {
		if (restored.current) return;
		restored.current = true;
		if (rememberedRun) void open(rememberedRun, true);
	}, []);
	const failed = chat.error && !credit ? chat.error : undefined;

	const last = chat.messages.at(-1);
	return (
		<SidePanel
			data-testid="agent-panel"
			width="assistant"
			title={t("label")}
			onClose={onClose}
			actions={
				<>
					<HistoryMenu onPick={(id) => void open(id)} />
					<IconButton
						label={t("conversation.new")}
						side="bottom"
						onClick={() => {
							chat.reset();
							rememberRun("");
							setPicked(null);
						}}
					>
						<Add aria-hidden />
					</IconButton>
				</>
			}
			footer={
				noKey ? undefined : (
					<ChatInput
						value={text}
						onValueChange={setText}
						onSubmit={send}
						onStop={() => void chat.stop()}
						busy={busy}
						disabled={!model && !settings?.fake}
						label={t("input.label")}
						placeholder={screen.screen === "entry" ? t("input.entry") : t("input.placeholder")}
						sendLabel={t("send")}
						stopLabel={t("stop")}
						aside={
							settings && settings.keys.length > 0 ? (
								<AgentModelPicker
									settings={settings}
									value={model}
									open={pickerOpen}
									onOpenChange={setPickerOpen}
									onChange={(next) => {
										setPicked(next);
										if (resendOnPick.current) {
											resendOnPick.current = false;
											// The request reads the model when it is sent, after this render.
											setTimeout(() => void chat.regenerate(), 0);
										}
									}}
								/>
							) : undefined
						}
					/>
				)
			}
		>
			{noKey ? (
				<NoKey />
			) : chat.messages.length === 0 ? (
				<EmptyState
					compact
					title={t("empty.title")}
					description={screen.screen === "entry" ? t("empty.entry") : t("empty.default")}
				/>
			) : (
				chat.messages.map((message) => (
					<MessageView
						key={message.id}
						message={message}
						streaming={chat.status === "streaming" && message === last && message.role === "assistant"}
					/>
				))
			)}
			{busy && last?.role === "user" && (
				<Text as="p" variant="meta" tone="subtle" role="status" aria-label={t("tool.running")}>
					…
				</Text>
			)}
			{credit && (
				<ChatError
					title={t("credit.title", { service: creditKey ? serviceName(creditKey.service) : "" })}
					actions={
						<TextButton
							type="button"
							variant="underline"
							onClick={() => {
								resendOnPick.current = true;
								setPickerOpen(true);
							}}
						>
							{t("credit.action")}
						</TextButton>
					}
				>
					{t("credit.text", { key: creditKey?.name ?? "", service: creditKey ? serviceName(creditKey.service) : "" })}
				</ChatError>
			)}
			{failed && (
				<ChatError
					title={errorText(site, failed, t("error.failed"))}
					actions={
						<TextButton type="button" variant="underline" onClick={() => void chat.regenerate()}>
							{t("error.retry")}
						</TextButton>
					}
				/>
			)}
			{openError && <ChatError title={openError} />}
			<div ref={endRef} />
		</SidePanel>
	);
}

/** The assistant as the admin's side panel (`defineAdminPlugin({ panel })`). A function of the site for the label's language; it lives here, in a client module, so the browser can call it. */
export const agentPanel = (site: Site): AdminPanel => ({
	label: site.createTranslator(agentPanelMessages)("label"),
	icon: Spark,
	Component: AgentPanel,
});
