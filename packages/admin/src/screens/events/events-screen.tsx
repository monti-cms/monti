"use client";

import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { AdminLink as Link } from "../../router";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty";
import { Skeleton } from "../../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { cmsFetch, errorText } from "../admin-api";
import { AdminShell } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { entryHref } from "../shared/entry-href";
import { formatDateTime } from "../shared/format-date";
import { EVENTS_KEY, EVENTS_LIST_KEY, type EventsList } from "./events-api";
import { eventsMessages } from "./messages";

const ERROR_MAX_LENGTH = 80;
const truncate = (text: string) => (text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH)}…` : text);

interface DeliveryKey {
	eventId: string;
	subscriber: string;
}

export function EventsScreen() {
	const site = useSite();
	const t = useTranslator(eventsMessages);
	const queryClient = useQueryClient();
	const { confirm, dialog } = useConfirm();

	const listQuery = useQuery({
		queryKey: EVENTS_LIST_KEY,
		queryFn: ({ signal }) =>
			cmsFetch<EventsList>(site, cmsApiUrl("/v1/events?state=failed&state=dead&limit=50&offset=0"), {
				signal,
				fallback: t("list.loadFailed"),
			}),
	});
	const items = listQuery.data?.items ?? [];
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
		<AdminShell
			title={t("title")}
			count={listQuery.data?.total}
			sidebar={{ activeNav: "events" }}
			headerActions={
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
			}
		>
			{error && (
				<Alert variant="danger" className="mx-5 mt-3 flex w-auto items-center justify-between">
					<AlertDescription className="col-start-auto">{error}</AlertDescription>
					<Button type="button" variant="outline" size="xs" onClick={() => void listQuery.refetch()}>
						{t("action.retry")}
					</Button>
				</Alert>
			)}
			<div className="min-h-0 flex-1 overflow-auto">
				{listQuery.isPending ? (
					<div className="space-y-2 p-5" aria-hidden>
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
					</div>
				) : items.length === 0 ? (
					!error && (
						<Empty className="h-full">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<BellRing aria-hidden />
								</EmptyMedia>
								<EmptyTitle>{t("list.empty")}</EmptyTitle>
							</EmptyHeader>
						</Empty>
					)
				) : (
					<Table aria-label={t("list.label")}>
						<TableHeader>
							<TableRow>
								<TableHead>{t("column.when")}</TableHead>
								<TableHead>{t("column.subscriber")}</TableHead>
								<TableHead>{t("column.kind")}</TableHead>
								<TableHead>{t("column.entry")}</TableHead>
								<TableHead>{t("column.state")}</TableHead>
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
								const key = { eventId: change.eventId, subscriber: item.subscriber };
								return (
									<TableRow key={`${change.eventId}:${item.subscriber}`}>
										<TableCell className="whitespace-nowrap">{formatDateTime(site, change.occurredAt)}</TableCell>
										<TableCell>{item.subscriber}</TableCell>
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
										<TableCell>
											<Badge variant={item.state === "dead" ? "destructive" : "secondary"}>
												{t(`state.${item.state}`)}
											</Badge>
										</TableCell>
										<TableCell className="tabular-nums">{item.attempts}</TableCell>
										<TableCell className="max-w-64 truncate" title={item.lastError ?? undefined}>
											{item.lastError ? truncate(item.lastError) : ""}
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{item.state === "failed" && item.nextAttemptAt ? formatDateTime(site, item.nextAttemptAt) : ""}
										</TableCell>
										<TableCell className="whitespace-nowrap text-right">
											<Button
												type="button"
												variant="outline"
												size="xs"
												aria-label={t("action.retryLabel", { subscriber: item.subscriber })}
												disabled={retry.isPending}
												onClick={() => retry.mutate(key)}
											>
												{t("action.retry")}
											</Button>{" "}
											<Button
												type="button"
												variant="ghost"
												size="xs"
												aria-label={t("action.dismissLabel", { subscriber: item.subscriber })}
												onClick={() => void requestDismiss(key)}
											>
												{t("action.dismiss")}
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</div>
			{dialog}
		</AdminShell>
	);
}
