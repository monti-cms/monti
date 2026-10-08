"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { AdminLink as Link } from "../../router/index.js";
import { Alert, AlertDescription } from "../../ui/alert.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty.js";
import { Skeleton } from "../../ui/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table.js";
import { cmsFetch, errorText } from "../admin-api.js";
import { AdminShell } from "../shared/admin-shell.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { entryHref } from "../shared/entry-href.js";
import { formatDateTime } from "../shared/format-date.js";
import { EVENTS_KEY, EVENTS_LIST_KEY } from "./events-api.js";
import { eventsMessages } from "./messages.js";
const ERROR_MAX_LENGTH = 80;
const truncate = (text) => (text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH)}…` : text);
export function EventsScreen() {
    const site = useSite();
    const t = useTranslator(eventsMessages);
    const queryClient = useQueryClient();
    const { confirm, dialog } = useConfirm();
    const listQuery = useQuery({
        queryKey: EVENTS_LIST_KEY,
        queryFn: ({ signal }) => cmsFetch(site, cmsApiUrl("/v1/events?state=failed&state=dead&limit=50&offset=0"), {
            signal,
            fallback: t("list.loadFailed"),
        }),
    });
    const items = listQuery.data?.items ?? [];
    const error = listQuery.error && !listQuery.data ? errorText(site, listQuery.error, t("list.loadFailed")) : null;
    const refresh = () => queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
    const retry = useMutation({
        mutationFn: (key) => cmsFetch(site, cmsApiUrl(`/v1/events/${encodeURIComponent(key.eventId)}/retry`), {
            method: "POST",
            json: { subscriber: key.subscriber },
            fallback: t("retry.failed"),
        }),
        onSuccess: () => toast.success(t("retry.done")),
        onError: (err) => toast.error(errorText(site, err, t("retry.failed"))),
        onSettled: refresh,
    });
    const dismiss = useMutation({
        mutationFn: (key) => cmsFetch(site, cmsApiUrl(`/v1/events/${encodeURIComponent(key.eventId)}/dismiss`), {
            method: "POST",
            json: { subscriber: key.subscriber },
            fallback: t("dismiss.failed"),
        }),
        onSuccess: () => toast.success(t("dismiss.done")),
        onError: (err) => toast.error(errorText(site, err, t("dismiss.failed"))),
        onSettled: refresh,
    });
    const retryAll = useMutation({
        mutationFn: () => cmsFetch(site, cmsApiUrl("/v1/events/retry"), {
            method: "POST",
            json: {},
            fallback: t("retryAll.failed"),
        }),
        onSuccess: (result) => toast.success(t("retryAll.done", { delivered: result.delivered, failed: result.failed, dead: result.dead })),
        onError: (err) => toast.error(errorText(site, err, t("retryAll.failed"))),
        onSettled: refresh,
    });
    const requestDismiss = async (key) => {
        const ok = await confirm({
            title: t("dismiss.title"),
            description: t("dismiss.ask", { subscriber: key.subscriber }),
            confirmLabel: t("action.dismiss"),
            destructive: true,
        });
        if (ok)
            dismiss.mutate(key);
    };
    return (_jsxs(AdminShell, { title: t("title"), count: listQuery.data?.total, sidebar: { activeNav: "events" }, headerActions: _jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: retryAll.isPending, onClick: () => retryAll.mutate(), children: [_jsx(RotateCw, { "aria-hidden": true }), t("action.retryAll")] }), children: [error && (_jsxs(Alert, { variant: "danger", className: "mx-5 mt-3 flex w-auto items-center justify-between", children: [_jsx(AlertDescription, { className: "col-start-auto", children: error }), _jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: () => void listQuery.refetch(), children: t("action.retry") })] })), _jsx("div", { className: "min-h-0 flex-1 overflow-auto", children: listQuery.isPending ? (_jsxs("div", { className: "space-y-2 p-5", "aria-hidden": true, children: [_jsx(Skeleton, { className: "h-8 w-full" }), _jsx(Skeleton, { className: "h-8 w-full" }), _jsx(Skeleton, { className: "h-8 w-full" })] })) : items.length === 0 ? (!error && (_jsx(Empty, { className: "h-full", children: _jsxs(EmptyHeader, { children: [_jsx(EmptyMedia, { variant: "icon", children: _jsx(BellRing, { "aria-hidden": true }) }), _jsx(EmptyTitle, { children: t("list.empty") })] }) }))) : (_jsxs(Table, { "aria-label": t("list.label"), children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: t("column.when") }), _jsx(TableHead, { children: t("column.subscriber") }), _jsx(TableHead, { children: t("column.kind") }), _jsx(TableHead, { children: t("column.entry") }), _jsx(TableHead, { children: t("column.state") }), _jsx(TableHead, { children: t("column.attempts") }), _jsx(TableHead, { children: t("column.lastError") }), _jsx(TableHead, { children: t("column.nextAttempt") }), _jsx(TableHead, { children: _jsx("span", { className: "sr-only", children: t("column.actions") }) })] }) }), _jsx(TableBody, { children: items.map((item) => {
                                const { change } = item;
                                const key = { eventId: change.eventId, subscriber: item.subscriber };
                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { className: "whitespace-nowrap", children: formatDateTime(site, change.occurredAt) }), _jsx(TableCell, { children: item.subscriber }), _jsx(TableCell, { children: t(`kind.${change.kind}`) }), _jsxs(TableCell, { children: [_jsxs("span", { className: "text-cms-muted-foreground", children: [change.collection, " "] }), change.kind === "deleted" ? (_jsx("span", { className: "font-mono text-xs", children: change.entryId })) : (_jsx(Link, { href: entryHref(site, change.collection, change.entryId), className: "underline", children: change.workingSlug ?? change.publishedSlug ?? change.entryId }))] }), _jsx(TableCell, { children: _jsx(Badge, { variant: item.state === "dead" ? "destructive" : "secondary", children: t(`state.${item.state}`) }) }), _jsx(TableCell, { className: "tabular-nums", children: item.attempts }), _jsx(TableCell, { className: "max-w-64 truncate", title: item.lastError ?? undefined, children: item.lastError ? truncate(item.lastError) : "" }), _jsx(TableCell, { className: "whitespace-nowrap", children: item.state === "failed" && item.nextAttemptAt ? formatDateTime(site, item.nextAttemptAt) : "" }), _jsxs(TableCell, { className: "whitespace-nowrap text-right", children: [_jsx(Button, { type: "button", variant: "outline", size: "xs", "aria-label": t("action.retryLabel", { subscriber: item.subscriber }), disabled: retry.isPending, onClick: () => retry.mutate(key), children: t("action.retry") }), " ", _jsx(Button, { type: "button", variant: "ghost", size: "xs", "aria-label": t("action.dismissLabel", { subscriber: item.subscriber }), onClick: () => void requestDismiss(key), children: t("action.dismiss") })] })] }, `${change.eventId}:${item.subscriber}`));
                            }) })] })) }), dialog] }));
}
