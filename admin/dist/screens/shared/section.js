import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils/cn.js";
import { Panel } from "../../ui/card.js";
/**
 * One section of a settings screen: the title and a one-line description in a column on the left, the content in a card on the right (stacked on a narrow
 * screen). A section is page > section > rows: the card holds fields or one list, never another bordered box.
 */
export function Section({ title, description, note, children, wide, card = true, className, testId, }) {
    return (_jsxs("section", { "data-testid": testId, className: cn("grid gap-x-8 gap-y-3 lg:items-start", wide ? "lg:grid-cols-[260px_minmax(0,1fr)]" : "lg:grid-cols-[220px_minmax(0,1fr)]", className), children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-base", children: title }), description && _jsx("p", { className: "mt-1.5 text-monti-muted-foreground text-sm leading-relaxed", children: description }), note && _jsx("p", { className: "mt-2.5 text-monti-muted-foreground text-xs leading-relaxed", children: note })] }), card ? (_jsx(Panel, { className: "flex min-w-0 flex-col gap-6 p-5", children: children })) : (_jsx("div", { className: "min-w-0", children: children }))] }));
}
