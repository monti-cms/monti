"use client";

import { errorText, useSite, useTranslator } from "@monti-cms/admin";
import {
	Box,
	ConversationGroupLabel,
	ConversationList,
	ConversationRow,
	ConversationRowMore,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	FilterButton,
	Text,
	toast,
} from "@monti-cms/admin/kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type AiSettingsView, UNOPENED_DAYS, type UnopenedDays } from "../connection";
import { agentPanelMessages } from "./agent-panel.messages";
import { type AgentRunView, aiKeys, deleteAgentRun, listAgentRuns, setUnopenedDays } from "./api";

const sameDay = (a: Date, b: Date) =>
	a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const two = (n: number) => String(n).padStart(2, "0");
/** When a conversation was last used: opened from this list, or asked in. */
const lastUsed = (run: AgentRunView) =>
	new Date(Math.max(Date.parse(run.updatedAt), run.openedAt ? Date.parse(run.openedAt) : 0));

/** The past conversations, newest first. */
export function useAgentRuns(enabled = true) {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	return useQuery({
		queryKey: aiKeys.agentRuns(),
		queryFn: ({ signal }) => listAgentRuns(site, { signal, fallback: t("history.failed") }),
		enabled,
		// Read each time it is shown: a conversation just had is the newest of the list.
		staleTime: 0,
	});
}

/** The setting at the foot of the list: how long a conversation nobody opened stays. */
function KeepUnopened({ settings }: { settings: AiSettingsView }) {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	const client = useQueryClient();
	const label = (days: UnopenedDays) => (days === null ? t("history.keepAll") : t("history.after", { days }));
	const choose = async (days: UnopenedDays) => {
		try {
			const next = await setUnopenedDays(
				site,
				{ expectedVersion: settings.version, unopenedDays: days },
				t("history.keepFailed"),
			);
			client.setQueryData(aiKeys.settings(), next);
		} catch (error) {
			toast.error(errorText(site, error, t("history.keepFailed")));
		}
	};
	return (
		<>
			<Box grow>
				<Text variant="note" tone="muted">
					{t("history.keep")}
				</Text>
			</Box>
			<DropdownMenu>
				<DropdownMenuTrigger render={<FilterButton filled />}>
					<Text variant="note">{label(settings.unopenedDays)}</Text>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuRadioGroup
						value={String(settings.unopenedDays)}
						onValueChange={(value) => void choose(value === "null" ? null : (Number(value) as UnopenedDays))}
					>
						{[...UNOPENED_DAYS, null].map((days) => (
							<DropdownMenuRadioItem key={String(days)} value={String(days)}>
								{label(days)}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}

/** The foot of the past conversations: the unopened-conversation setting. */
export function AgentHistoryFoot({ settings }: { settings: AiSettingsView }) {
	return <KeepUnopened settings={settings} />;
}

/**
 * The past conversations (flow 2 · 25), in the panel in place of the conversation: today's, then the earlier ones, each with what was asked first and
 * when; its ⋯ deletes it. The open one is marked. Picking one opens it.
 */
export function AgentHistory({
	current,
	onPick,
	onDeleted,
}: {
	/** The conversation open in the panel. */
	current: string | undefined;
	onPick: (id: string) => void;
	/** A conversation was deleted (the panel lets go of it when it was the open one). */
	onDeleted: (id: string) => void;
}) {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	const client = useQueryClient();
	const runs = useAgentRuns();
	const now = new Date();
	const remove = async (run: AgentRunView) => {
		try {
			await deleteAgentRun(site, run.id, t("history.deleteFailed"));
			client.setQueryData<{ items: AgentRunView[]; total: number }>(aiKeys.agentRuns(), (data) =>
				data ? { items: data.items.filter((item) => item.id !== run.id), total: data.total - 1 } : data,
			);
			onDeleted(run.id);
		} catch (error) {
			toast.error(errorText(site, error, t("history.deleteFailed")));
		}
	};
	const items = runs.data?.items ?? [];
	const today = items.filter((run) => sameDay(lastUsed(run), now));
	const earlier = items.filter((run) => !sameDay(lastUsed(run), now));
	const row = (run: AgentRunView) => {
		const at = lastUsed(run);
		const when = sameDay(at, now)
			? `${two(at.getHours())}:${two(at.getMinutes())}`
			: `${two(at.getMonth() + 1)}. ${two(at.getDate())}`;
		return (
			<ConversationRow
				key={run.id}
				title={run.title || t("history.untitled")}
				meta={
					run.outcome ? (
						<>
							{when} ·{" "}
							{run.outcome.kind === "pending" ? (
								<Text variant="meta" tone="warning">
									{t("history.outcome.pending")}
								</Text>
							) : run.outcome.kind === "applied" ? (
								t("history.outcome.applied", { count: run.outcome.count })
							) : (
								t(`history.outcome.${run.outcome.kind}`)
							)}
						</>
					) : (
						when
					)
				}
				current={run.id === current}
				onClick={() => onPick(run.id)}
				menu={
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<ConversationRowMore aria-label={t("history.menu", { title: run.title })} />}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem variant="danger" onClick={() => void remove(run)}>
								{t("history.delete")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				}
			/>
		);
	};
	return (
		<ConversationList data-testid="agent-history">
			{runs.isPending && (
				<Text variant="note" tone="subtle">
					{t("history.loading")}
				</Text>
			)}
			{runs.error && (
				<Text variant="note" tone="danger">
					{errorText(site, runs.error, t("history.failed"))}
				</Text>
			)}
			{runs.data && items.length === 0 && (
				<Text variant="note" tone="subtle">
					{t("history.empty")}
				</Text>
			)}
			{today.length > 0 && <ConversationGroupLabel>{t("history.today")}</ConversationGroupLabel>}
			{today.map(row)}
			{earlier.length > 0 && <ConversationGroupLabel>{t("history.earlier")}</ConversationGroupLabel>}
			{earlier.map(row)}
		</ConversationList>
	);
}
