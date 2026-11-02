"use client";

import { Add, RecentlyViewed } from "@carbon/icons-react";
import {
	type AdminPanel,
	type AdminPanelProps,
	type AdminScreen,
	errorText,
	type Site,
	usePanelRequest,
	useScreenContext,
	useSite,
	useTranslator,
} from "@monti-cms/admin";
import {
	Box,
	Button,
	ChatDate,
	ChatError,
	ChatInput,
	ChatThread,
	Chip,
	IconButton,
	SidePanel,
	Spark,
	Stack,
	Suggest,
	SuggestLabel,
	SuggestList,
	Text,
	TextButton,
	usePreference,
} from "@monti-cms/admin/kit";
import { AdminLink } from "@monti-cms/admin/router";
import { useEffect, useRef, useState } from "react";
import { type AgentModelChoice, type AiSettingsView, CREDIT_EXHAUSTED } from "../connection";
import { serviceName } from "../service-models";
import { MessageView } from "./agent-conversation";
import { AgentHistory, AgentHistoryFoot, useAgentRuns } from "./agent-history";
import { AgentModelPicker, DEFAULT_THINKING, thinks } from "./agent-model-picker";
import { agentPanelMessages } from "./agent-panel.messages";
import { getAgentRun } from "./api";
import { type AgentMessage, useAgentChat } from "./use-agent-chat";
import { useAiSettings } from "./use-ai-settings";

/** Tools › API keys, where a key of an AI service is added. */
const KEYS_SCREEN = "/tools/api-keys";

/** How many requests asked before the empty panel offers. */
const RECENT_REQUESTS = 2;

/** The id of the open conversation, as the preference holds it (empty: none). */
const RUN_CODEC = { parse: (raw: string) => raw, serialize: (value: string) => value };

/** The model a new conversation starts with: the built-in default, thinking at the default level when it can. `null` when there is none. */
function defaultModel(settings: AiSettingsView | undefined): AgentModelChoice | null {
	const fallback = settings?.assistant;
	if (!settings || !fallback) return null;
	const choice = { keyId: fallback.keyId, model: fallback.model };
	return { ...choice, thinking: thinks(settings, choice) ? DEFAULT_THINKING : "off" };
}

/** The default requests of each screen: the words of the group and of each request, as message keys. A screen not listed has none. */
const DEFAULT_REQUESTS = {
	entries: { label: "requests.entries", items: ["requests.entries.emptySummary", "requests.entries.oldDrafts"] },
	entry: { label: "requests.entry", items: ["requests.entry.review", "requests.entry.related"] },
	media: { label: "requests.media", items: ["requests.media.noAlt", "requests.media.unused"] },
} as const;
const requestsOf = (screen: AdminScreen) =>
	screen in DEFAULT_REQUESTS ? DEFAULT_REQUESTS[screen as keyof typeof DEFAULT_REQUESTS] : undefined;

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

/** The empty panel (flow 2 · 01): the default requests of this screen, then the last few things asked. Pressing one sends it as the admin's words. */
function StartRequests({ screen, onSend }: { screen: AdminScreen; onSend: (text: string) => void }) {
	const t = useTranslator(agentPanelMessages);
	const runs = useAgentRuns();
	const defaults = requestsOf(screen);
	const offered = new Set(defaults?.items.map((key) => t(key)));
	const recent = [
		...new Set((runs.data?.items ?? []).map((run) => run.title).filter((title) => title && !offered.has(title))),
	].slice(0, RECENT_REQUESTS);
	return (
		<SuggestList data-testid="agent-start">
			{defaults && (
				<>
					<SuggestLabel>{t(defaults.label)}</SuggestLabel>
					{defaults.items.map((key) => (
						<Suggest key={key} kind="request" onClick={() => onSend(t(key))}>
							{t(key)}
						</Suggest>
					))}
				</>
			)}
			{recent.length > 0 && (
				<>
					<SuggestLabel>{t("requests.recent")}</SuggestLabel>
					{recent.map((title) => (
						<Suggest key={title} kind="recent" onClick={() => onSend(title)}>
							{title}
						</Suggest>
					))}
				</>
			)}
		</SuggestList>
	);
}

const two = (n: number) => String(n).padStart(2, "0");

/** The day of a conversation from another day, over its messages ("10. 24 (Fri)"); nothing for one had today. */
function dayOf(site: Site, createdAt: string | undefined): string | undefined {
	if (!createdAt) return undefined;
	const at = new Date(createdAt);
	const now = new Date();
	if (at.toDateString() === now.toDateString()) return undefined;
	const weekday = new Intl.DateTimeFormat(site.ADMIN_LOCALE, { weekday: "short" }).format(at);
	return `${two(at.getMonth() + 1)}. ${two(at.getDate())} (${weekday})`;
}

/** Whether the answer got anywhere before it stopped: a tool call or words of the assistant after the last thing the admin asked. */
const madeProgress = (messages: readonly AgentMessage[]) => {
	const last = messages.at(-1);
	return last?.role === "assistant" && last.parts.some((part) => part.type !== "step-start");
};

/**
 * The assistant, as the admin's side panel: the conversation with its tool lines, the box to ask in with what the request is about (the picked rows),
 * the model it runs on, and the past conversations. Empty, it offers this screen's default requests and the recent ones. It knows where the admin is
 * (`useScreenContext`), and on the entry editor it reads the open entry through the editor tools. A screen can open it for something (`usePanelRequest`).
 */
export function AgentPanel({ onClose }: AdminPanelProps) {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	const screen = useScreenContext();
	const settings = useAiSettings().data;
	const [view, setView] = useState<"chat" | "history">("chat");
	// The model of this conversation: picked in the chat input, or the built-in default (`null` until one is picked).
	const [picked, setPicked] = useState<AgentModelChoice | null>(null);
	const model = picked ?? defaultModel(settings);
	// The picked rows go with the request until the admin takes them off the box; picking other rows offers them again.
	const pickedIds = screen.selectedIds ?? [];
	const pickedKey = pickedIds.join(",");
	const [droppedKey, setDroppedKey] = useState<string | null>(null);
	const withPicked = pickedIds.length > 0 && droppedKey !== pickedKey;
	const chat = useAgentChat(picked, { withPicked });
	const [pickerOpen, setPickerOpen] = useState(false);
	// "Send with another model": the next pick sends the refused request again on that model.
	const resendOnPick = useRef(false);
	const chatRef = useRef(chat);
	chatRef.current = chat;
	const [text, setText] = useState("");
	const [openError, setOpenError] = useState<string | null>(null);
	const [openedAt, setOpenedAt] = useState<string>();
	// Every screen mounts the panel again: the open conversation is remembered in this browser and picked up where the admin left it.
	const [rememberedRun, rememberRun] = usePreference("agent-run", RUN_CODEC, "");
	const inputRef = useRef<HTMLDivElement>(null);
	const busy = chat.status === "submitted" || chat.status === "streaming";
	const noKey = settings !== undefined && !settings.fake && settings.keys.length === 0;
	const credit = chat.error?.message === CREDIT_EXHAUSTED;
	const creditKey = credit && model ? settings?.keys.find((key) => key.id === model.keyId) : undefined;

	const { runId } = chat;
	useEffect(() => {
		if (runId) rememberRun(runId);
	}, [runId, rememberRun]);

	// `request`: a screen's button sent it (a blue spark marks it in the conversation).
	const send = (message: string, request = false) => {
		if (busy || noKey) return;
		setText("");
		setOpenError(null);
		setView("chat");
		const metadata = {
			...(withPicked ? { picked: { screen: screen.screen, count: pickedIds.length } } : {}),
			...(request ? { request: true } : {}),
		};
		void chat.sendMessage({ text: message, metadata });
	};
	const open = async (id: string, restoring = false) => {
		setOpenError(null);
		try {
			const run = await getAgentRun(site, id, { fallback: t("run.openFailed") });
			// The admin may have started typing while a remembered conversation loaded: theirs wins.
			if (restoring && chatRef.current.messages.length > 0) return;
			chat.reopen(id, run.messages);
			setPicked(run.model ?? null);
			setOpenedAt(run.createdAt);
			setView("chat");
		} catch (error) {
			// A conversation that is gone is forgotten; one the admin picked says it could not be opened.
			if (restoring) rememberRun("");
			else setOpenError(errorText(site, error, t("run.openFailed")));
		}
	};
	const startNew = () => {
		chat.reset();
		rememberRun("");
		setPicked(null);
		setOpenedAt(undefined);
		setView("chat");
	};
	const restored = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: restores once, when the panel appears
	useEffect(() => {
		if (restored.current) return;
		restored.current = true;
		if (rememberedRun) void open(rememberedRun, true);
	}, []);

	// A screen opened the panel for something: send its words, or put the admin in the box.
	const incoming = usePanelRequest();
	// biome-ignore lint/correctness/useExhaustiveDependencies: handles each request once, when it arrives
	useEffect(() => {
		if (!incoming) return;
		incoming.take();
		setView("chat");
		if (incoming.request.text) send(incoming.request.text, true);
		else inputRef.current?.querySelector("textarea")?.focus();
	}, [incoming]);

	const failed = chat.error && !credit ? chat.error : undefined;
	const cut = failed !== undefined && madeProgress(chat.messages);
	const last = chat.messages.at(-1);
	const day = dayOf(site, openedAt);
	const notice = credit ? (
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
	) : cut ? (
		<ChatError
			title={t("cut.title")}
			actions={
				<TextButton type="button" variant="underline" onClick={() => void chat.sendMessage()}>
					{t("cut.action")}
				</TextButton>
			}
		>
			{t("cut.text")}
		</ChatError>
	) : failed ? (
		<ChatError
			title={errorText(site, failed, t("error.failed"))}
			actions={
				<TextButton type="button" variant="underline" onClick={() => void chat.regenerate()}>
					{t("error.retry")}
				</TextButton>
			}
		/>
	) : null;
	// A notice about the answer sits in it, under what it got done; one before any answer stands on its own.
	const noticeInAnswer = notice !== null && last?.role === "assistant";

	if (view === "history") {
		return (
			<SidePanel
				data-testid="agent-panel"
				width="assistant"
				title={t("history.label")}
				back={{ label: t("history.back"), onClick: () => setView("chat") }}
				onClose={onClose}
				bleed
				footer={settings ? <AgentHistoryFoot settings={settings} /> : undefined}
			>
				<AgentHistory
					current={runId}
					onPick={(id) => void open(id)}
					onDeleted={(id) => {
						if (id === runId) startNew();
					}}
				/>
			</SidePanel>
		);
	}

	return (
		<SidePanel
			data-testid="agent-panel"
			width="assistant"
			title={t("label")}
			onClose={onClose}
			bleed
			actions={
				<>
					<IconButton label={t("history.label")} side="bottom" onClick={() => setView("history")}>
						<RecentlyViewed aria-hidden />
					</IconButton>
					<IconButton label={t("conversation.new")} side="bottom" onClick={startNew}>
						<Add aria-hidden />
					</IconButton>
				</>
			}
			composer={
				noKey ? undefined : (
					<div ref={inputRef}>
						<ChatInput
							value={text}
							onValueChange={setText}
							onSubmit={(message) => send(message)}
							onStop={() => void chat.stop()}
							busy={busy}
							disabled={!model && !settings?.fake}
							label={t("input.label")}
							placeholder={screen.screen === "entry" ? t("input.entry") : t("input.placeholder")}
							sendLabel={t("send")}
							stopLabel={t("stop")}
							{...(withPicked
								? {
										context: (
											<Chip onRemove={() => setDroppedKey(pickedKey)} removeLabel={t("picked.remove")}>
												{screen.screen === "media"
													? t("picked.media", { count: pickedIds.length })
													: t("picked.entries", { count: pickedIds.length })}
											</Chip>
										),
									}
								: {})}
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
					</div>
				)
			}
		>
			{noKey ? (
				<NoKey />
			) : chat.messages.length === 0 && !notice && !openError ? (
				<StartRequests screen={screen.screen} onSend={(words) => send(words)} />
			) : (
				<ChatThread data-testid="agent-thread">
					{day && <ChatDate>{day}</ChatDate>}
					{chat.messages.map((message) => (
						<MessageView key={message.id} message={message} live={busy && message === last}>
							{message === last && noticeInAnswer ? notice : null}
						</MessageView>
					))}
					{busy && last?.role === "user" && (
						<Text as="p" variant="meta" tone="subtle" role="status" aria-label={t("tool.running")}>
							<Spark aria-hidden />
						</Text>
					)}
					{!noticeInAnswer && notice}
					{openError && <ChatError title={openError} />}
				</ChatThread>
			)}
		</SidePanel>
	);
}

/** The assistant as the admin's side panel (`defineAdminPlugin({ panel })`). A function of the site for the label's language; it lives here, in a client module, so the browser can call it. */
export const agentPanel = (site: Site): AdminPanel => ({
	label: site.createTranslator(agentPanelMessages)("label"),
	icon: Spark,
	Component: AgentPanel,
});
