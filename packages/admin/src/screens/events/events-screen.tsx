"use client";

import { Restart } from "@carbon/icons-react";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	EntryStatus,
	Inline,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tabs,
	TabsList,
	TabsTrigger,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { errorText } from "../../api/client";
import {
	type DeliveryKey,
	dismissEvent,
	EVENTS_FILTERS,
	type EventDeliveryItem,
	type EventsFilter,
	eventsKeys,
	listEvents,
	retryAllEvents,
	retryEvent,
} from "../../api/events";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import { enumParam, pageParam, pageSizeParam, useUrlState } from "../../lib/hooks/use-url-state";
import { AdminLink as Link } from "../../router";
import { useConfirm } from "../shared/confirm-dialog";
import { EmptyState } from "../shared/empty-state";
import { entryHref } from "../shared/entry-href";
import { formatDateTime } from "../shared/format-date";
import { ListPagination } from "../shared/list-pager";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { ToolsFrame } from "../tools/tools-frame";
import { EventDetailPanel } from "./event-detail-panel";
import { eventCollectionLabel, eventEntryLabel, STATE_STATUS } from "./event-display";
import { eventsMessages } from "./messages";

/** The filter and page live in the address, so a refresh keeps them and the address can be shared. */
const EVENTS_PARAMS = {
	filter: enumParam(EVENTS_FILTERS, "all"),
	page: pageParam,
	pageSize: pageSizeParam,
};

const ERROR_MAX_LENGTH = 80;
const truncate = (text: string) => (text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH)}…` : text);

/** All / Failed / Pending / Delivered: the page's underline tabs, used as a filter (a value, no panels). */
function FilterTabs({
	filter,
	options,
	onChange,
}: {
	filter: EventsFilter;
	options: { value: EventsFilter; label: string }[];
	onChange: (next: EventsFilter) => void;
}) {
	const t = useTranslator(eventsMessages);
	return (
		<Tabs value={filter} onValueChange={(value) => onChange(value as EventsFilter)}>
			<TabsList variant="bar" aria-label={t("filter.label")}>
				{options.map((option) => (
					<TabsTrigger key={option.value} value={option.value}>
						{option.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}

export function EventsScreen() {
	const site = useSite();
	const t = useTranslator(eventsMessages);
	const tc = useTranslator(commonMessages);
	const { confirm, dialog } = useConfirm();

	const [{ filter, page, pageSize }, update] = useUrlState(EVENTS_PARAMS);
	const listQuery = useQuery({
		queryKey: eventsKeys.list(filter, page, pageSize),
		queryFn: ({ signal }) => listEvents(site, filter, page, pageSize, signal, t("list.loadFailed")),
		placeholderData: keepPreviousData,
	});
	const items = listQuery.data?.items ?? [];
	// The opened row is kept by its key, so a refetch (a retry, a dismiss) shows its new state in the detail.
	const [openedKey, setOpenedKey] = useState<string | null>(null);
	const rowKey = (item: EventDeliveryItem) => `${item.change.eventId}:${item.subscriber ?? ""}`;
	const opened = openedKey === null ? null : (items.find((item) => rowKey(item) === openedKey) ?? null);
	/** Deliveries the retry can still send (pending or failed and due); recorded, delivered and dead ones give it nothing to do. */
	const counts = listQuery.data?.counts;
	const waiting = counts ? counts.pending + counts.failed : 0;
	// Delivery results only exist for a webhook. When no loaded row has a subscriber, the columns about deliveries have nothing to say.
	const recordedOnly = items.length > 0 && items.every((item) => item.subscriber === null);
	const changeFilter = (filter: EventsFilter) => update({ filter });
	const filterOptions = EVENTS_FILTERS.map((value) => ({ value, label: t(`filter.${value}`) }));
	const error = listQuery.error && !listQuery.data ? errorText(site, listQuery.error, t("list.loadFailed")) : null;

	const retry = useCmsMutation({
		fn: (key: DeliveryKey, { site }) => retryEvent(site, key, t("retry.failed")),
		success: t("retry.done"),
		failure: t("retry.failed"),
		invalidate: [eventsKeys.all],
	});
	const dismiss = useCmsMutation({
		fn: (key: DeliveryKey, { site }) => dismissEvent(site, key, t("dismiss.failed")),
		success: t("dismiss.done"),
		failure: t("dismiss.failed"),
		invalidate: [eventsKeys.all],
	});
	const retryAll = useCmsMutation({
		// biome-ignore lint/suspicious/noConfusingVoidType: a mutation without variables, so `mutate()` takes no argument
		fn: (_: void, { site }) => retryAllEvents(site, t("retryAll.failed")),
		success: (result) => t("retryAll.done", { delivered: result.delivered, failed: result.failed, dead: result.dead }),
		failure: t("retryAll.failed"),
		invalidate: [eventsKeys.all],
	});

	const requestDismiss = async (key: DeliveryKey) => {
		const ok = await confirm({
			title: t("dismiss.title"),
			description: t("dismiss.ask", { subscriber: key.subscriber }),
			confirmLabel: t("action.dismiss"),
			destructive: true,
		});
		if (ok) dismiss.mutate(key);
	};

	return (
		<ToolsFrame
			tab="events"
			actions={
				waiting > 0 ? (
					<Button
						type="button"
						size="sm"
						variant="secondary"
						disabled={retryAll.isPending}
						onClick={() => retryAll.mutate()}
					>
						<Restart aria-hidden />
						{t("action.retryAll")}
					</Button>
				) : undefined
			}
		>
			<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
				<Stack gap={0} grow minWidth={0} minHeight={0} overflow="hidden">
					<FilterTabs filter={filter} options={filterOptions} onChange={changeFilter} />
					{error && (
						<Box paddingX={32} paddingTop={12}>
							<LoadErrorAlert message={error} onRetry={() => void listQuery.refetch()} />
						</Box>
					)}
					<Stack gap={0} grow minHeight={0} overflow="auto">
						{listQuery.isPending ? (
							<Box paddingX={32} paddingY={16}>
								<Text as="p" variant="note" tone="subtle" role="status">
									{tc("loading")}
								</Text>
							</Box>
						) : items.length === 0 ? (
							!error && (
								<Box paddingX={32}>
									{filter === "all" ? (
										<EmptyState title={t("list.emptyYet")} description={t("list.emptyYetHint")} />
									) : (
										<EmptyState
											title={t("list.emptyNoMatch")}
											description={t("list.emptyNoMatchHint")}
											action={{ label: t("list.clearFilters"), onClick: () => changeFilter("all") }}
										/>
									)}
								</Box>
							)
						) : (
							<Table aria-label={t("list.label")}>
								<TableHeader>
									<TableRow>
										<TableHead>{t("column.state")}</TableHead>
										<TableHead>{t("column.when")}</TableHead>
										{!recordedOnly && <TableHead>{t("column.subscriber")}</TableHead>}
										<TableHead>{t("column.kind")}</TableHead>
										<TableHead>{t("column.entry")}</TableHead>
										<TableHead>{t("column.actor")}</TableHead>
										{!recordedOnly && <TableHead>{t("column.attempts")}</TableHead>}
										{!recordedOnly && <TableHead>{t("column.lastError")}</TableHead>}
										{!recordedOnly && <TableHead>{t("column.nextAttempt")}</TableHead>}
										<TableHead>
											<Text srOnly>{t("column.actions")}</Text>
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{items.map((item) => {
										const { change } = item;
										const key = { eventId: change.eventId, subscriber: item.subscriber ?? "" };
										return (
											<TableRow key={rowKey(item)} onClick={() => setOpenedKey(rowKey(item))}>
												<TableCell>
													<EntryStatus status={STATE_STATUS[item.state]}>{t(`state.${item.state}`)}</EntryStatus>
												</TableCell>
												<TableCell>{formatDateTime(site, change.occurredAt)}</TableCell>
												{!recordedOnly && (
													<TableCell>
														<Text variant="caption" mono>
															{item.subscriber ?? ""}
														</Text>
													</TableCell>
												)}
												<TableCell>
													<TextButton
														render={<button type="button" />}
														mono
														aria-label={t("detail.open", {
															kind: t(`kind.${change.kind}`),
															entry: eventEntryLabel(change),
														})}
														onClick={(event) => {
															event.stopPropagation();
															setOpenedKey(rowKey(item));
														}}
													>
														{t(`kind.${change.kind}`)}
													</TextButton>
												</TableCell>
												<TableCell>
													<Text tone="muted">{eventCollectionLabel(site, change.collection)} · </Text>
													{change.kind === "deleted" ? (
														<Text>{eventEntryLabel(change)}</Text>
													) : (
														<TextButton
															variant="underline"
															render={<Link href={entryHref(site, change.collection, change.entryId)} />}
															onClick={(event) => event.stopPropagation()}
														>
															{eventEntryLabel(change)}
														</TextButton>
													)}
												</TableCell>
												<TableCell>{change.actor ?? ""}</TableCell>
												{!recordedOnly && (
													<>
														<TableCell align="end">{item.attempts}</TableCell>
														<TableCell truncate title={item.lastError ?? undefined}>
															{item.lastError ? truncate(item.lastError) : ""}
														</TableCell>
														<TableCell>
															{item.state === "failed" && item.nextAttemptAt
																? formatDateTime(site, item.nextAttemptAt)
																: ""}
														</TableCell>
													</>
												)}
												<TableCell align="end" onClick={(event) => event.stopPropagation()}>
													{(item.state === "failed" || item.state === "dead") && (
														<Inline gap={4} justify="end">
															<Button
																type="button"
																variant="secondary"
																size="sm"
																aria-label={t("action.retryLabel", { subscriber: item.subscriber ?? "" })}
																disabled={retry.isPending}
																onClick={() => retry.mutate(key)}
															>
																{tc("retry")}
															</Button>
															<TextButton
																type="button"
																aria-label={t("action.dismissLabel", { subscriber: item.subscriber ?? "" })}
																onClick={() => void requestDismiss(key)}
															>
																{t("action.dismiss")}
															</TextButton>
														</Inline>
													)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}
					</Stack>
					<ListPagination
						total={listQuery.data?.total ?? 0}
						shown={items.length}
						page={page}
						pageSize={pageSize}
						onPageChange={(next) => update({ page: next })}
						onPageSizeChange={(size) => update({ pageSize: size })}
					/>
					{dialog}
				</Stack>
				{opened && (
					<EventDetailPanel
						item={opened}
						deliveries={items.filter((item) => item.change.eventId === opened.change.eventId)}
						onClose={() => setOpenedKey(null)}
					/>
				)}
			</Inline>
		</ToolsFrame>
	);
}
