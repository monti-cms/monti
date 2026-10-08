"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { cn } from "../lib/utils/index.js";
import { Button } from "./button.js";
import { uiMessages } from "./messages.js";
function Pagination({ className, ...props }) {
    const t = useTranslator(uiMessages);
    return (_jsx("nav", { role: "navigation", "aria-label": t("pagination.label"), "data-slot": "pagination", className: cn("mx-auto flex w-full justify-center", className), ...props }));
}
function PaginationContent({ className, ...props }) {
    return _jsx("ul", { "data-slot": "pagination-content", className: cn("flex items-center gap-1", className), ...props });
}
function PaginationItem({ ...props }) {
    return _jsx("li", { "data-slot": "pagination-item", ...props });
}
function PaginationLink({ className, isActive, size = "icon", ...props }) {
    return (_jsx(Button, { variant: isActive ? "outline" : "ghost", size: size, className: cn(className), nativeButton: false, render: _jsx("a", { "aria-current": isActive ? "page" : undefined, "data-slot": "pagination-link", "data-active": isActive, ...props }) }));
}
function PaginationPrevious({ className, text, ...props }) {
    const t = useTranslator(uiMessages);
    text ??= t("pagination.previous");
    return (_jsxs(PaginationLink, { "aria-label": t("pagination.previousPage"), size: "default", className: cn("pl-2!", className), ...props, children: [_jsx(ChevronLeftIcon, { "data-icon": "inline-start" }), _jsx("span", { className: "hidden sm:block", children: text })] }));
}
function PaginationNext({ className, text, ...props }) {
    const t = useTranslator(uiMessages);
    text ??= t("pagination.next");
    return (_jsxs(PaginationLink, { "aria-label": t("pagination.nextPage"), size: "default", className: cn("pr-2!", className), ...props, children: [_jsx("span", { className: "hidden sm:block", children: text }), _jsx(ChevronRightIcon, { "data-icon": "inline-end" })] }));
}
function PaginationEllipsis({ className, ...props }) {
    const t = useTranslator(uiMessages);
    return (_jsxs("span", { "aria-hidden": true, "data-slot": "pagination-ellipsis", className: cn("flex size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4", className), ...props, children: [_jsx(MoreHorizontalIcon, {}), _jsx("span", { className: "sr-only", children: t("pagination.more") })] }));
}
export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, };
