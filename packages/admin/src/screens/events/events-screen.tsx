"use client";

import { cmsApiUrl, type PageSize, useSite, useTranslator } from "@monti-cms/core/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, ChevronDown, ListFilter, RotateCw, SearchX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/utils/cn";
import { AdminLink as Link } from "../../router";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Skeleton } from "../../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { cmsFetch, errorText } from "../admin-api";
import { PageActions } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { EmptyState } from "../shared/empty-state";
import { entryHref } from "../shared/entry-href";
import { formatDateTime } from "../shared/format-date";
import { ListPagination } from "../shared/list-pager";
import {
	EVENTS_FILTERS,
	EVENTS_KEY,
	EVENTS_LIST_KEY,
	type EventDeliveryItem,
	type EventsFilter,
	type EventsList,
	eventsQuery,
} from "./events-api";
import { eventsMessages } from "./messages";

const ERROR_MAX_LENGTH = 80;
const truncate = (text: string) => (text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH)}…` : text);

const STATE_TONE: Record<EventDeliveryItem["state"], string> = {
	delivered: "text-emerald-600 cms-dark:text-emerald-400",
	failed: "text-red-600 cms-dark:text-red-400",
	dead: "text-red-600 cms-dark:text-red-400",
	pending: "text-amber-600 cms-dark:text-amber-400",
	delivering: "text-amber-600 cms-dark:text-amber-400",
	dismissed: "text-cms-muted-foreground",
	recorded: "text-cms-muted-foreground",
};

/** Colored dot plus the state name, like the entries list status column (never color alone). */
function StateLabel({ state, label }: { state: EventDeliveryItem["state"]; label: string }) {
	return (
		<span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-cms-foreground/80">
			<svg
				aria-hidden="true"
				focusable="false"
				viewBox="0 0 16 16"
				className={cn("size-3.5 shrink-0", STATE_TONE[state])}
				fill="currentColor"
			>
				<circle cx="8" cy="8" r="5.5" />
			</svg>
			{label}
		</span>
	);
}

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

interface DeliveryKey {
	eventId: string;
	subscriber: string;
}

export function EventsScreen() {
	const site = useSite();
	const t = useTranslator(eventsMessages);
	const queryClient = useQueryClient();
	const { confirm, dialog } = useConfirm();

	const [filter, setFilter] = useState<EventsFilter>("all");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<PageSize>(25);
	const listQuery = useQuery({
		queryKey: [...EVENTS_LIST_KEY, filter, page, pageSize],
		queryFn: ({ signal }) =>
			cmsFetch<EventsList>(site, cmsApiUrl(`/v1/events?${eventsQuery(filter, page, pageSize)}`), {
				signal,
				fallback: t("list.loadFailed"),
			}),
		placeholderData: keepPreviousData,
	});
	const items = listQuery.data?.items ?? [];
	const changeFilter = (next: EventsFilter) => {
		setFilter(next);
		setPage(1);
	};
	const filterOptions = EVENTS_FILTERS.map((value) => ({ value, label: t(`filter.${value}`) }));
	const error = listQuery.error && !listQuery.data ? errorText(site, listQuery.error, t("list.loadFailed")) : null;
	const refresh = () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY });

	const retry = useMutation({
		mutationFn: (key: DeliveryKey) =>
			cmsFetch(site, cmsApiUrl(`/v1/events/${encodeURIComponent(key.eventId)}/retry`), {
				method: "POST",
				json: { subscriber: key.subscriber },
				fallback: t("retry.failed"),
			}),
		onSuccess: () => toast.success(t("retry.done")),
		onError: (err) => toast.error(errorText(site, err, t("retry.failed"))),
		onSettled: refresh,
	});
	const dismiss = useMutation({
		mutationFn: (key: DeliveryKey) =>
			cmsFetch(site, cmsApiUrl(`/v1/events/${encodeURIComponent(key.eventId)}/dismiss`), {
				method: "POST",
				json: { subscriber: key.subscriber },
				fallback: t("dismiss.failed"),
			}),
		onSuccess: () => toast.success(t("dismiss.done")),
		onError: (err) => toast.error(errorText(site, err, t("dismiss.failed"))),
		onSettled: refresh,
	});
	const retryAll = useMutation({
		mutationFn: () =>
			cmsFetch<{ delivered: number; failed: number; dead: number }>(site, cmsApiUrl("/v1/events/retry"), {
				method: "POST",
				json: {},
				fallback: t("retryAll.failed"),
			}),
		onSuccess: (result) =>
			toast.success(t("retryAll.done", { delivered: result.delivered, failed: result.failed, dead: result.dead })),
		onError: (err) => toast.error(errorText(site, err, t("retryAll.failed"))),
		onSettled: refresh,
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
			{error && (
				<Alert variant="danger" className="mx-5 mt-3 flex w-auto items-center justify-between">
					<AlertDescription className="col-start-auto">{error}</AlertDescription>
					<Button type="button" variant="outline" size="xs" onClick={() => void listQuery.refetch()}>
						{t("action.retry")}
					</Button>
				</Alert>
			)}
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
											<StateLabel state={item.state} label={t(`state.${item.state}`)} />
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
				onPageChange={setPage}
				onPageSizeChange={(size) => {
					setPageSize(size);
					setPage(1);
				}}
			/>
			{dialog}
		</div>
	);
}
