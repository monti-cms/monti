import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { cn } from "../lib/utils/index.js";
import { uiMessages } from "./messages.js";
/**
 * An error as the person reads it: what went wrong, what to do (when known), and the developer text folded under "Details".
 * Build the notice with `errorNotice()` of `@monti-cms/admin`.
 */
function ErrorNoticeView({ notice, className, ...props }) {
    const t = useTranslator(uiMessages);
    return (_jsxs("div", { role: "alert", "data-slot": "error-notice", className: cn("flex flex-col gap-1 text-monti-destructive text-xs", className), ...props, children: [_jsx("p", { className: "whitespace-pre-wrap", children: notice.message }), notice.fix && _jsx("p", { className: "text-monti-muted-foreground", children: notice.fix }), notice.detail && (_jsxs("details", { className: "text-monti-muted-foreground", children: [_jsx("summary", { className: "cursor-pointer select-none", children: t("error.details") }), _jsx("pre", { className: "mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-monti-muted/40 p-2 font-mono text-[11px]", children: notice.detail })] }))] }));
}
export { ErrorNoticeView };
