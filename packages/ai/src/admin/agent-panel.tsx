"use client";

import {
	type AdminPanel,
	CmsApiError,
	errorText,
	type Site,
	useScreenContext,
	useSite,
	useTranslator,
} from "@monti-cms/admin";
import {
	Alert,
	Box,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
	EmptyState,
	IconButton,
	Inline,
	Spinner,
	Stack,
	Text,
	Textarea,
	TextLink,
	usePreference,
} from "@monti-cms/admin/kit";
import { AdminLink } from "@monti-cms/admin/router";
import { useQuery } from "@tanstack/react-query";
import { History, Send, Sparkles, Square, SquarePen } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { AiAgentModelView } from "../connection";
import { MessageView } from "./agent-conversation";
import { agentPanelMessages } from "./agent-panel.messages";
import { aiKeys, getAgentRun, listAgentRuns } from "./api";
import { useAiSettings } from "./connection-editor";
import { useAgentChat } from "./use-agent-chat";

/** The AI screen, where the connection and the model of the assistant are set. */
const AI_SCREEN = "/tools/ai";

/** The id of the open conversation, as the preference holds it (empty: none). */
const RUN_CODEC = { parse: (raw: string) => raw, serialize: (value: string) => value };

/** Why the assistant can't run, from what is known before asking (the AI settings) or from the refusal of the last request. */
type Unavailable = "no-connection" | "no-tools";

function unavailableOf(
	settings: { fake: boolean; agent: { effective: AiAgentModelView | null } } | undefined,
	error: Error | undefined,
): Unavailable | null {
	if (error instanceof CmsApiError) {
		if (error.code === "agent_unavailable") return "no-tools";
		if (error.code === "service_unavailable") return "no-connection";
	}
	if (!settings || settings.fake) return null;
	const { effective } = settings.agent;
	if (!effective) return "no-connection";
	return effective.tools === false ? "no-tools" : null;
}

function UnavailableNotice({ reason, model }: { reason: Unavailable; model?: string }) {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	return (
		<Alert tone="warning" layout="stack">
			<Stack gap="tight">
				<Text as="p">
					{reason === "no-connection"
						? t("unavailable.noConnection")
						: t("unavailable.noTools", { model: model ?? "" })}{" "}
					{reason === "no-connection" ? t("unavailable.noConnection.fix") : t("unavailable.noTools.fix")}
				</Text>
				<TextLink tone="accent" render={<AdminLink href={site.adminHref(AI_SCREEN)} />}>
					{t("unavailable.link")}
				</TextLink>
			</Stack>
		</Alert>
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
				<History aria-hidden />
			</IconButton>
			<DropdownMenuContent align="end" width="lg">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{t("history.label")}</DropdownMenuLabel>
					{runs.isPending && (
						<DropdownMenuItem disabled>
							<Spinner size="sm" />
						</DropdownMenuItem>
					)}
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
export function AgentPanel() {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	const screen = useScreenContext();
	const settings = useAiSettings().data;
	const chat = useAgentChat();
	const [text, setText] = useState("");
	const [openError, setOpenError] = useState<string | null>(null);
	// Every screen mounts the panel again: the open conversation is remembered in this browser and picked up where the admin left it.
	const [rememberedRun, rememberRun] = usePreference("agent-run", RUN_CODEC, "");
	const endRef = useRef<HTMLDivElement>(null);
	const busy = chat.status === "submitted" || chat.status === "streaming";
	const unavailable = unavailableOf(settings, chat.error);
	const effective = settings?.agent.effective ?? null;

	// Keep the newest part in view while the answer streams.
	// biome-ignore lint/correctness/useExhaustiveDependencies: scrolls whenever the messages change
	useEffect(() => {
		endRef.current?.scrollIntoView?.({ block: "end" });
	}, [chat.messages]);

	const { runId } = chat;
	useEffect(() => {
		if (runId) rememberRun(runId);
	}, [runId, rememberRun]);

	const send = (event?: FormEvent) => {
		event?.preventDefault();
		const message = text.trim();
		if (!message || busy || unavailable === "no-connection") return;
		setText("");
		setOpenError(null);
		void chat.sendMessage({ text: message });
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) send(event);
	};
	const open = async (id: string, restoring = false) => {
		setOpenError(null);
		try {
			chat.reopen(id, (await getAgentRun(site, id, { fallback: t("run.openFailed") })).messages);
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
	const failed = chat.error && !(chat.error instanceof CmsApiError && unavailable !== null) ? chat.error : undefined;

	return (
		<Stack gap="none" grow minHeight={0} data-testid="agent-panel">
			<Inline gap="tight" justify="between" shrink={false} border="bottom" paddingX="comfortable" paddingY="tight">
				<Box minWidth={0}>
					{effective && (
						<Text variant="caption" tone="muted" truncate>
							{t("model.use", { model: effective.model, connection: effective.providerName })}
						</Text>
					)}
				</Box>
				<Inline gap="hair">
					<HistoryMenu onPick={(id) => void open(id)} />
					<IconButton
						label={t("conversation.new")}
						side="bottom"
						onClick={() => {
							chat.reset();
							rememberRun("");
						}}
					>
						<SquarePen aria-hidden />
					</IconButton>
				</Inline>
			</Inline>

			<Stack gap="comfortable" grow minHeight={0} overflow="y" padding="comfortable">
				{chat.messages.length === 0 ? (
					<EmptyState
						compact
						icon={Sparkles}
						title={t("empty.title")}
						description={screen.screen === "entry" ? t("empty.entry") : t("empty.default")}
					/>
				) : (
					chat.messages.map((message) => <MessageView key={message.id} message={message} />)
				)}
				{busy && chat.messages.at(-1)?.role === "user" && <Spinner size="sm" />}
				{failed && (
					<Alert tone="danger" layout="stack">
						<Stack gap="tight">
							<Text as="p">{errorText(site, failed, t("error.failed"))}</Text>
							<Box>
								<Button type="button" variant="outline" size="sm" onClick={() => void chat.regenerate()}>
									{t("error.retry")}
								</Button>
							</Box>
						</Stack>
					</Alert>
				)}
				{openError && (
					<Alert tone="danger" layout="stack">
						<Text as="p">{openError}</Text>
					</Alert>
				)}
				<div ref={endRef} />
			</Stack>

			<Stack gap="condensed" shrink={false} border="top" padding="comfortable">
				{unavailable && <UnavailableNotice reason={unavailable} model={effective?.model} />}
				<form onSubmit={send}>
					<Stack gap="condensed">
						<Textarea
							size="sm"
							aria-label={t("input.label")}
							placeholder={t("input.placeholder")}
							value={text}
							disabled={unavailable === "no-connection"}
							onChange={(event) => setText(event.target.value)}
							onKeyDown={onKeyDown}
						/>
						<Inline gap="condensed" justify="between">
							<Text variant="caption" tone="muted">
								{chat.usage && chat.usage.totalTokens > 0
									? t("usage.tokens", { count: chat.usage.totalTokens.toLocaleString() })
									: ""}
							</Text>
							{busy ? (
								<Button type="button" variant="outline" size="sm" onClick={() => void chat.stop()}>
									<Square aria-hidden />
									{t("stop")}
								</Button>
							) : (
								<Button type="submit" size="sm" disabled={!text.trim() || unavailable === "no-connection"}>
									<Send aria-hidden />
									{t("send")}
								</Button>
							)}
						</Inline>
					</Stack>
				</form>
			</Stack>
		</Stack>
	);
}

/** The assistant as the admin's side panel (`defineAdminPlugin({ panel })`). A function of the site for the label's language; it lives here, in a client module, so the browser can call it. */
export const agentPanel = (site: Site): AdminPanel => ({
	label: site.createTranslator(agentPanelMessages)("label"),
	icon: Sparkles,
	Component: AgentPanel,
});
