"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BellRing, ChevronDown, ListFilter, RotateCw, SearchX } from "lucide-react";
import { errorText } from "../../api/client.js";
import { dismissEvent, EVENTS_FILTERS, eventsKeys, listEvents, retryAllEvents, retryEvent, } from "../../api/events.js";
import { useCmsMutation } from "../../api/use-cms-mutation.js";
import { commonMessages } from "../../lib/common.messages.js";
import { enumParam, pageParam, pageSizeParam, useUrlState } from "../../lib/hooks/use-url-state.js";
import { cn } from "../../lib/utils/cn.js";
import { AdminLink as Link } from "../../router/index.js";
import { Button } from "../../ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { Skeleton } from "../../ui/skeleton.js";
import { StatusIndicator } from "../../ui/status-indicator.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table.js";
import { PageActions } from "../shared/admin-shell.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { EmptyState } from "../shared/empty-state.js";
import { entryHref } from "../shared/entry-href.js";
import { formatDateTime } from "../shared/format-date.js";
import { ListPagination } from "../shared/list-pager.js";
import { LoadErrorAlert } from "../shared/load-error-alert.js";
import { eventsMessages } from "./messages.js";
/** The filter and page live in the address, so a refresh keeps them and the address can be shared. */
const EVENTS_PARAMS = {
    filter: enumParam(EVENTS_FILTERS, "all"),
    page: pageParam,
    pageSize: pageSizeParam,
};
const ERROR_MAX_LENGTH = 80;
const truncate = (text) => (text.length > ERROR_MAX_LENGTH ? `${text.slice(0, ERROR_MAX_LENGTH)}…` : text);
const STATE_TONE = {
    delivered: "success",
    failed: "destructive",
    dead: "destructive",
    pending: "warning",
    delivering: "warning",
    dismissed: "neutral",
    recorded: "neutral",
};
/** Status column header; its popup filters deliveries by status, like the entries list column headers. */
function StateHeader({ filter, options, onChange, }) {
    const t = useTranslator(eventsMessages);
    const filtered = filter !== "all";
    return (_jsxs(Popover, { children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: cn("-ml-2 h-7 gap-1 px-2 font-normal text-monti-muted-foreground text-xs", filtered && "text-monti-primary"), "aria-label": `${t("column.state")}${filtered ? t("filter.activeSuffix") : ""}` }), children: [t("column.state"), filtered ? (_jsx(ListFilter, { "aria-hidden": true, className: "size-3.5 fill-current", "data-filtered": "" })) : (_jsx(ChevronDown, { "aria-hidden": true, className: "size-3.5 opacity-60" }))] }), _jsx(PopoverContent, { align: "start", className: "w-56 p-3", children: _jsxs("fieldset", { className: "flex flex-col gap-1", children: [_jsx("legend", { className: "sr-only", children: t("filter.label") }), options.map((option) => (_jsx(Button, { type: "button", variant: filter === option.value ? "secondary" : "ghost", size: "sm", "aria-pressed": filter === option.value, className: "justify-start", onClick: () => onChange(option.value), children: option.label }, option.value)))] }) })] }));
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
    /** Deliveries the retry can still send (pending or failed and due); recorded, delivered and dead ones give it nothing to do. */
    const counts = listQuery.data?.counts;
    const waiting = counts ? counts.pending + counts.failed : 0;
    const changeFilter = (filter) => update({ filter });
    const filterOptions = EVENTS_FILTERS.map((value) => ({ value, label: t(`filter.${value}`) }));
    const error = listQuery.error && !listQuery.data ? errorText(site, listQuery.error, t("list.loadFailed")) : null;
    const retry = useCmsMutation({
        fn: (key, { site }) => retryEvent(site, key, t("retry.failed")),
        success: t("retry.done"),
        failure: t("retry.failed"),
        invalidate: [eventsKeys.all],
    });
    const dismiss = useCmsMutation({
        fn: (key, { site }) => dismissEvent(site, key, t("dismiss.failed")),
        success: t("dismiss.done"),
        failure: t("dismiss.failed"),
        invalidate: [eventsKeys.all],
    });
    const retryAll = useCmsMutation({
        // biome-ignore lint/suspicious/noConfusingVoidType: a mutation without variables, so `mutate()` takes no argument
        fn: (_, { site }) => retryAllEvents(site, t("retryAll.failed")),
        success: (result) => t("retryAll.done", { delivered: result.delivered, failed: result.failed, dead: result.dead }),
        failure: t("retryAll.failed"),
        invalidate: [eventsKeys.all],
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
    return (_jsxs("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden", children: [waiting > 0 && (_jsx(PageActions, { children: _jsxs(Button, { type: "button", size: "sm", variant: "outline", disabled: retryAll.isPending, onClick: () => retryAll.mutate(), children: [_jsx(RotateCw, { "aria-hidden": true }), t("action.retryAll")] }) })), error && _jsx(LoadErrorAlert, { message: error, onRetry: () => void listQuery.refetch(), className: "mx-5 mt-3" }), _jsx("div", { className: "flex min-h-0 flex-1 flex-col overflow-auto", children: listQuery.isPending ? (_jsxs("div", { className: "space-y-2 p-5", "aria-hidden": true, children: [_jsx(Skeleton, { className: "h-8 w-full" }), _jsx(Skeleton, { className: "h-8 w-full" }), _jsx(Skeleton, { className: "h-8 w-full" })] })) : items.length === 0 ? (!error &&
                    (filter === "all" ? (_jsx(EmptyState, { icon: BellRing, title: t("list.emptyYet"), description: t("list.emptyYetHint") })) : (_jsx(EmptyState, { icon: SearchX, title: t("list.emptyNoMatch"), description: t("list.emptyNoMatchHint"), action: { label: t("list.clearFilters"), onClick: () => changeFilter("all") } })))) : (_jsxs(Table, { "aria-label": t("list.label"), children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(TableHead, { children: _jsx(StateHeader, { filter: filter, options: filterOptions, onChange: changeFilter }) }), _jsx(TableHead, { children: t("column.when") }), _jsx(TableHead, { children: t("column.subscriber") }), _jsx(TableHead, { children: t("column.kind") }), _jsx(TableHead, { children: t("column.entry") }), _jsx(TableHead, { children: t("column.actor") }), _jsx(TableHead, { children: t("column.attempts") }), _jsx(TableHead, { children: t("column.lastError") }), _jsx(TableHead, { children: t("column.nextAttempt") }), _jsx(TableHead, { children: _jsx("span", { className: "sr-only", children: t("column.actions") }) })] }) }), _jsx(TableBody, { children: items.map((item) => {
                                const { change } = item;
                                const key = { eventId: change.eventId, subscriber: item.subscriber ?? "" };
                                return (_jsxs(TableRow, { children: [_jsx(TableCell, { children: _jsx(StatusIndicator, { tone: STATE_TONE[item.state], label: t(`state.${item.state}`) }) }), _jsx(TableCell, { className: "whitespace-nowrap", children: formatDateTime(site, change.occurredAt) }), _jsx(TableCell, { children: item.subscriber ?? "" }), _jsx(TableCell, { children: t(`kind.${change.kind}`) }), _jsxs(TableCell, { children: [_jsxs("span", { className: "text-monti-muted-foreground", children: [change.collection, " "] }), change.kind === "deleted" ? (_jsx("span", { className: "font-mono text-xs", children: change.entryId })) : (_jsx(Link, { href: entryHref(site, change.collection, change.entryId), className: "underline", children: change.workingSlug ?? change.publishedSlug ?? change.entryId }))] }), _jsx(TableCell, { children: change.actor ?? "" }), _jsx(TableCell, { className: "tabular-nums", children: item.attempts }), _jsx(TableCell, { className: "max-w-64 truncate", title: item.lastError ?? undefined, children: item.lastError ? truncate(item.lastError) : "" }), _jsx(TableCell, { className: "whitespace-nowrap", children: item.state === "failed" && item.nextAttemptAt ? formatDateTime(site, item.nextAttemptAt) : "" }), _jsx(TableCell, { className: "whitespace-nowrap text-right", children: (item.state === "failed" || item.state === "dead") && (_jsxs(_Fragment, { children: [_jsx(Button, { type: "button", variant: "outline", size: "xs", "aria-label": t("action.retryLabel", { subscriber: item.subscriber ?? "" }), disabled: retry.isPending, onClick: () => retry.mutate(key), children: tc("retry") }), " ", _jsx(Button, { type: "button", variant: "ghost", size: "xs", "aria-label": t("action.dismissLabel", { subscriber: item.subscriber ?? "" }), onClick: () => void requestDismiss(key), children: t("action.dismiss") })] })) })] }, `${change.eventId}:${item.subscriber ?? ""}`));
                            }) })] })) }), _jsx(ListPagination, { total: listQuery.data?.total ?? 0, shown: items.length, page: page, pageSize: pageSize, onPageChange: (next) => update({ page: next }), onPageSizeChange: (size) => update({ pageSize: size }) }), dialog] }));
}
