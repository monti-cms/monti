"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet.js";
import { StatusIndicator } from "../../ui/status-indicator.js";
import { formatDateTime } from "../shared/format-date.js";
import { eventEntryLabel, STATE_TONE } from "./event-display.js";
import { eventsMessages } from "./messages.js";
function Row({ label, children }) {
    return (_jsxs("div", { className: "grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm", children: [_jsx("dt", { className: "text-monti-muted-foreground", children: label }), _jsx("dd", { className: "min-w-0 break-words", children: children })] }));
}
const Mono = ({ children }) => _jsx("span", { className: "font-mono text-xs", children: children });
/**
 * Everything the log knows about one event: the entry it was made on, who made it and when, and how it went to each subscriber.
 * `deliveries` are the rows of the same event on the page (one per subscriber); `item` is the one that was opened.
 */
export function EventDetailSheet({ item, deliveries, onClose, }) {
    const site = useSite();
    const t = useTranslator(eventsMessages);
    const change = item?.change;
    return (_jsx(Sheet, { open: item !== null, onOpenChange: (open) => !open && onClose(), children: _jsxs(SheetContent, { className: "gap-0 overflow-y-auto sm:max-w-md", children: [_jsxs(SheetHeader, { children: [_jsx(SheetTitle, { children: change ? `${t(`kind.${change.kind}`)} · ${eventEntryLabel(change)}` : t("detail.title") }), _jsx(SheetDescription, { children: t("detail.description") })] }), item && change && (_jsxs("dl", { className: "divide-y px-4 pb-4", children: [_jsx(Row, { label: t("detail.eventId"), children: _jsx(Mono, { children: change.eventId }) }), _jsx(Row, { label: t("column.kind"), children: t(`kind.${change.kind}`) }), _jsx(Row, { label: t("column.when"), children: formatDateTime(site, change.occurredAt) }), _jsx(Row, { label: t("column.actor"), children: change.actor ?? "—" }), _jsx(Row, { label: t("detail.title.entry"), children: change.title ?? "—" }), _jsx(Row, { label: t("detail.entryId"), children: _jsx(Mono, { children: change.entryId }) }), _jsx(Row, { label: t("detail.collection"), children: change.collection }), _jsx(Row, { label: t("detail.locale"), children: change.locale ?? "—" }), _jsx(Row, { label: t("detail.workingSlug"), children: change.workingSlug ?? "—" }), _jsx(Row, { label: t("detail.publishedSlug"), children: change.publishedSlug ?? "—" }), _jsx(Row, { label: t("detail.translationGroup"), children: change.translationGroupId ? _jsx(Mono, { children: change.translationGroupId }) : "—" }), _jsx(Row, { label: t("detail.version"), children: change.version ?? "—" }), _jsx(Row, { label: t("detail.subscribers"), children: deliveries.some((delivery) => delivery.subscriber !== null) ? (_jsx("ul", { className: "space-y-2", children: deliveries.map((delivery) => (_jsxs("li", { className: "space-y-0.5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { children: delivery.subscriber ?? "" }), _jsx(StatusIndicator, { tone: STATE_TONE[delivery.state], label: t(`state.${delivery.state}`) })] }), _jsxs("div", { className: "text-monti-muted-foreground text-xs", children: [t("detail.attempts", { count: delivery.attempts }), delivery.lastAttemptAt ? ` · ${formatDateTime(site, delivery.lastAttemptAt)}` : ""] }), delivery.lastError && _jsx("div", { className: "text-monti-destructive text-xs", children: delivery.lastError })] }, delivery.subscriber ?? ""))) })) : (t("state.recorded")) })] }))] }) }));
}
