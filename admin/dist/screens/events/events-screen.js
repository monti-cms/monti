"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, ChevronDown, ListFilter, RotateCw, SearchX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/utils/cn.js";
import { AdminLink as Link } from "../../router/index.js";
import { Alert, AlertDescription } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { Skeleton } from "../../ui/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table.js";
import { cmsFetch, errorText } from "../admin-api.js";
import { PageActions } from "../shared/admin-shell.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { EmptyState } from "../shared/empty-state.js";
import { entryHref } from "../shared/entry-href.js";
import { formatDateTime } from "../shared/format-date.js";
import { ListPagination } from "../shared/list-pager.js";
import { EVENTS_FILTERS, EVENTS_KEY, EVENTS_LIST_KEY, eventsQuery, } from "./events-api.js";
import { eventsMessages } from "./messages.js";
const ERROR_MAX_LENGTH = 80;
const truncate = (text) => (text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH)}…` : text);
const STATE_TONE = {
    delivered: "text-emerald-600 cms-dark:text-emerald-400",
    failed: "text-red-600 cms-dark:text-red-400",
    dead: "text-red-600 cms-dark:text-red-400",
    pending: "text-amber-600 cms-dark:text-amber-400",
    delivering: "text-amber-600 cms-dark:text-amber-400",
    dismissed: "text-cms-muted-foreground",
    recorded: "text-cms-muted-foreground",
};
/** Colored dot plus the state name, like the entries list status column (never color alone). */
function StateLabel({ state, label }) {
    return (_jsxs("span", { className: "inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-cms-foreground/80", children: [_jsx("svg", { "aria-hidden": "true", focusable: "false", viewBox: "0 0 16 16", className: cn("size-3.5 shrink-0", STATE_TONE[state]), fill: "currentColor", children: _jsx("circle", { cx: "8", cy: "8", r: "5.5" }) }), label] }));
}
/** Status column header; its popup filters deliveries by status, like the entries list column headers. */
function StateHeader({ filter, options, onChange, }) {
    const t = useTranslator(eventsMessages);
    const filtered = filter !== "all";
    return (_jsxs(Popover, { children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: cn("-ml-2 h-7 gap-1 px-2 font-normal text-cms-muted-foreground text-xs", filtered && "text-cms-primary"), "aria-label": `${t("column.state")}${filtered ? t("filter.activeSuffix") : ""}` }), children: [t("column.state"), filtered ? (_jsx(ListFilter, { "aria-hidden": true, className: "size-3.5 fill-current", "data-filtered": "" })) : (_jsx(ChevronDown, { "aria-hidden": true, className: "size-3.5 opacity-60" }))] }), _jsx(PopoverContent, { align: "start", className: "w-56 p-3", children: _jsxs("fieldset", { className: "flex flex-col gap-1", children: [_jsx("legend", { className: "sr-only", children: t("filter.label") }), options.map((option) => (_jsx(Button, { type: "button", variant: filter === option.value ? "secondary" : "ghost", size: "sm", "aria-pressed": filter === option.value, className: "justify-start", onClick: () => onChange(option.value), children: option.label }, option.value)))] }) })] }));
}
export function EventsScreen() {
    const site = useSite();
    const t = useTranslator(eventsMessages);
    const queryClient = useQueryClient();
    const { confirm, dialog } = useConfirm();
    const [filter, setFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const listQuery = useQuery({
        queryKey: [...EVENTS_LIST_KEY, filter, page, pageSize],
        queryFn: ({ signal }) => cmsFetch(site, cmsApiUrl(`/v1/events?${eventsQuery(filter, page, pageSize)}`), {
            signal,
            fallback: t("list.loadFailed"),
        }),
        placeholderData: keepPreviousData,
    });
    const items = listQuery.data?.items ?? [];
    const changeFilter = (next) => {
        setFilter(next);
        setPage(1);
    };
    const filterOptions = EVENTS_FILTERS.map((value) => ({ value, label: t(`filter.${value}`) }));
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
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden", children: [_jsx(PageActions, { children: _jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: retryAll.isPending, onClick: () => retryAll.mutate(), children: [_jsx(RotateCw, { "aria-hidden": true }), t("action.retryAll")] }) }), error && (_jsxs(Alert, { variant: "danger", className: "mx-5 mt-3 flex w-auto items-center justify-between", children: [_jsx(AlertDescription, { className: "col-start-auto", children: error }), _jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: () => void listQuery.refetch(), children: t("action.retry") })] })), _jsx("div", { className: "flex min-h-0 flex-1 flex-col overflow-auto", children: listQuery.isPending ? (_jsxs("div", { className: "space-y-2 p-5", "aria-hidden": true, children: [_jsx(Skeleton, { className: "h-8 w-full" }), _jsx(Skeleton, { className: "h-8 w-full" }), _jsx(Skeleton, { className: "h-8 w-full" })] })) : items.length === 0 ? (!error &&
                    (filter === "all" ? (_jsx(EmptyState, { icon: BellRing, title: t("list.emptyYet"), description: t("list.emptyYetHint") })) : (_jsx(EmptyState, { icon: SearchX, title: t("list.emptyNoMatch"), description: t("list.emptyNoMatchHint"), action: { label: t("list.clearFilters"), onClick: () => changeFilter("all") } })))) : (_jsxs(Table, { "aria-label": t("list.label"), children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: _jsx(StateHeader, { filter: filter, options: filterOptions, onChange: changeFilter }) }), _jsx(TableHead, { children: t("column.when") }), _jsx(TableHead, { children: t("column.subscriber") }), _jsx(TableHead, { children: t("column.kind") }), _jsx(TableHead, { children: t("column.entry") }), _jsx(TableHead, { children: t("column.actor") }), _jsx(TableHead, { children: t("column.attempts") }), _jsx(TableHead, { children: t("column.lastError") }), _jsx(TableHead, { children: t("column.nextAttempt") }), _jsx(TableHead, { children: _jsx("span", { className: "sr-only", children: t("column.actions") }) })] }) }), _jsx(TableBody, { children: items.map((item) => {
                                const { change } = item;
                                const key = { eventId: change.eventId, subscriber: item.subscriber ?? "" };
                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx(StateLabel, { state: item.state, label: t(`state.${item.state}`) }) }), _jsx(TableCell, { className: "whitespace-nowrap", children: formatDateTime(site, change.occurredAt) }), _jsx(TableCell, { children: item.subscriber ?? "" }), _jsx(TableCell, { children: t(`kind.${change.kind}`) }), _jsxs(TableCell, { children: [_jsxs("span", { className: "text-cms-muted-foreground", children: [change.collection, " "] }), change.kind === "deleted" ? (_jsx("span", { className: "font-mono text-xs", children: change.entryId })) : (_jsx(Link, { href: entryHref(site, change.collection, change.entryId), className: "underline", children: change.workingSlug ?? change.publishedSlug ?? change.entryId }))] }), _jsx(TableCell, { children: change.actor ?? "" }), _jsx(TableCell, { className: "tabular-nums", children: item.attempts }), _jsx(TableCell, { className: "max-w-64 truncate", title: item.lastError ?? undefined, children: item.lastError ? truncate(item.lastError) : "" }), _jsx(TableCell, { className: "whitespace-nowrap", children: item.state === "failed" && item.nextAttemptAt ? formatDateTime(site, item.nextAttemptAt) : "" }), _jsx(TableCell, { className: "whitespace-nowrap text-right", children: (item.state === "failed" || item.state === "dead") && (_jsxs(_Fragment, { children: [_jsx(Button, { type: "button", variant: "outline", size: "xs", "aria-label": t("action.retryLabel", { subscriber: item.subscriber ?? "" }), disabled: retry.isPending, onClick: () => retry.mutate(key), children: t("action.retry") }), " ", _jsx(Button, { type: "button", variant: "ghost", size: "xs", "aria-label": t("action.dismissLabel", { subscriber: item.subscriber ?? "" }), onClick: () => void requestDismiss(key), children: t("action.dismiss") })] })) })] }, `${change.eventId}:${item.subscriber ?? ""}`));
                            }) })] })) }), _jsx(ListPagination, { total: listQuery.data?.total ?? 0, shown: items.length, page: page, pageSize: pageSize, onPageChange: setPage, onPageSizeChange: (size) => {
                    setPageSize(size);
                    setPage(1);
                } }), dialog] }));
}
