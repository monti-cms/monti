"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BellRing, ChevronDown, ListFilter, RotateCw, SearchX } from "lucide-react";
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
import { enumParam, pageParam, pageSizeParam, useUrlState } from "../../lib/hooks/use-url-state";
import { cn } from "../../lib/utils/cn";
import { AdminLink as Link } from "../../router";
import { Button } from "../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Skeleton } from "../../ui/skeleton";
import { StatusIndicator, type StatusTone } from "../../ui/status-indicator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { PageActions } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { EmptyState } from "../shared/empty-state";
import { entryHref } from "../shared/entry-href";
import { formatDateTime } from "../shared/format-date";
import { ListPagination } from "../shared/list-pager";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { eventsMessages } from "./messages";

/** The filter and page live in the address, so a refresh keeps them and the address can be shared. */
const EVENTS_PARAMS = {
	filter: enumParam(EVENTS_FILTERS, "all"),
	page: pageParam,
	pageSize: pageSizeParam,
};

const ERROR_MAX_LENGTH = 80;
const truncate = (text: string) => (text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH)}…` : text);

const STATE_TONE: Record<EventDeliveryItem["state"], StatusTone> = {
	delivered: "success",
	failed: "destructive",
	dead: "destructive",
	pending: "warning",
	delivering: "warning",
	dismissed: "neutral",
	recorded: "neutral",
};

/** Status column header; its popup filters deliveries by status, like the entries list column headers. */
function StateHeader({
	filter,
	options,
	onChange,
}: {
	filter: EventsFilter;
	options: { value: EventsFilter; label: string }[];
	onChange: (next: EventsFilter) => void;
}) {
	const t = useTranslator(eventsMessages);
	const filtered = filter !== "all";
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"-ml-2 h-7 gap-1 px-2 font-normal text-cms-muted-foreground text-xs",
							filtered && "text-cms-primary",
						)}
						aria-label={`${t("column.state")}${filtered ? t("filter.activeSuffix") : ""}`}
					/>
				}
			>
				{t("column.state")}
				{filtered ? (
					<ListFilter aria-hidden className="size-3.5 fill-current" data-filtered="" />
				) : (
					<ChevronDown aria-hidden className="size-3.5 opacity-60" />
				)}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-56 p-3">
				<fieldset className="flex flex-col gap-1">
					<legend className="sr-only">{t("filter.label")}</legend>
					{options.map((option) => (
						<Button
							key={option.value}
							type="button"
							variant={filter === option.value ? "secondary" : "ghost"}
							size="sm"
							aria-pressed={filter === option.value}
							className="justify-start"
							onClick={() => onChange(option.value)}
						>
							{option.label}
						</Button>
					))}
				</fieldset>
			</PopoverContent>
		</Popover>
	);
}

export function EventsScreen() {
	const site = useSite();
	const t = useTranslator(eventsMessages);
	const { confirm, dialog } = useConfirm();

	const [{ filter, page, pageSize }, update] = useUrlState(EVENTS_PARAMS);
	const listQuery = useQuery({
		queryKey: eventsKeys.list(filter, page, pageSize),
		queryFn: ({ signal }) => listEvents(site, filter, page, pageSize, signal, t("list.loadFailed")),
		placeholderData: keepPreviousData,
	});
	const items = listQuery.data?.items ?? [];
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
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			{items.length > 0 && (
				<PageActions>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={retryAll.isPending}
						onClick={() => retryAll.mutate()}
					>
						<RotateCw aria-hidden />
						{t("action.retryAll")}
					</Button>
				</PageActions>
			)}
			{error && <LoadErrorAlert message={error} onRetry={() => void listQuery.refetch()} className="mx-5 mt-3" />}
			<div className="flex min-h-0 flex-1 flex-col overflow-auto">
				{listQuery.isPending ? (
					<div className="space-y-2 p-5" aria-hidden>
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
					</div>
				) : items.length === 0 ? (
					!error &&
					(filter === "all" ? (
						<EmptyState icon={BellRing} title={t("list.emptyYet")} description={t("list.emptyYetHint")} />
					) : (
						<EmptyState
							icon={SearchX}
							title={t("list.emptyNoMatch")}
							description={t("list.emptyNoMatchHint")}
							action={{ label: t("list.clearFilters"), onClick: () => changeFilter("all") }}
						/>
					))
				) : (
					<Table aria-label={t("list.label")}>
						<TableHeader>
							<TableRow>
								<TableHead>
									<StateHeader filter={filter} options={filterOptions} onChange={changeFilter} />
								</TableHead>
								<TableHead>{t("column.when")}</TableHead>
								<TableHead>{t("column.subscriber")}</TableHead>
								<TableHead>{t("column.kind")}</TableHead>
								<TableHead>{t("column.entry")}</TableHead>
								<TableHead>{t("column.actor")}</TableHead>
								<TableHead>{t("column.attempts")}</TableHead>
								<TableHead>{t("column.lastError")}</TableHead>
								<TableHead>{t("column.nextAttempt")}</TableHead>
								<TableHead>
									<span className="sr-only">{t("column.actions")}</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((item) => {
								const { change } = item;
								const key = { eventId: change.eventId, subscriber: item.subscriber ?? "" };
								return (
									<TableRow key={`${change.eventId}:${item.subscriber ?? ""}`}>
										<TableCell>
											<StatusIndicator tone={STATE_TONE[item.state]} label={t(`state.${item.state}`)} />
										</TableCell>
										<TableCell className="whitespace-nowrap">{formatDateTime(site, change.occurredAt)}</TableCell>
										<TableCell>{item.subscriber ?? ""}</TableCell>
										<TableCell>{t(`kind.${change.kind}`)}</TableCell>
										<TableCell>
											<span className="text-cms-muted-foreground">{change.collection} </span>
											{change.kind === "deleted" ? (
												<span className="font-mono text-xs">{change.entryId}</span>
											) : (
												<Link href={entryHref(site, change.collection, change.entryId)} className="underline">
													{change.workingSlug ?? change.publishedSlug ?? change.entryId}
												</Link>
											)}
										</TableCell>
										<TableCell>{change.actor ?? ""}</TableCell>
										<TableCell className="tabular-nums">{item.attempts}</TableCell>
										<TableCell className="max-w-64 truncate" title={item.lastError ?? undefined}>
											{item.lastError ? truncate(item.lastError) : ""}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{item.state === "failed" && item.nextAttemptAt ? formatDateTime(site, item.nextAttemptAt) : ""}
										</TableCell>
										<TableCell className="whitespace-nowrap text-right">
											{(item.state === "failed" || item.state === "dead") && (
												<>
													<Button
														type="button"
														variant="outline"
														size="xs"
														aria-label={t("action.retryLabel", { subscriber: item.subscriber ?? "" })}
														disabled={retry.isPending}
														onClick={() => retry.mutate(key)}
													>
														{t("action.retry")}
													</Button>{" "}
													<Button
														type="button"
														variant="ghost"
														size="xs"
														aria-label={t("action.dismissLabel", { subscriber: item.subscriber ?? "" })}
														onClick={() => void requestDismiss(key)}
													>
														{t("action.dismiss")}
													</Button>
												</>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</div>
			<ListPagination
				total={listQuery.data?.total ?? 0}
				shown={items.length}
				page={page}
				pageSize={pageSize}
				onPageChange={(next) => update({ page: next })}
				onPageSizeChange={(size) => update({ pageSize: size })}
			/>
			{dialog}
		</div>
	);
}
