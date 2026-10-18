import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils/cn.js";
import { FormFieldDescription, FormFieldLabel, FormField as UiField } from "../../ui/field.js";
/** How wide the control of a field is: short values and choices stay narrow, text takes more, a list or a row of controls takes the whole width. */
export const CONTROL_WIDTH = { narrow: "max-w-sm", normal: "max-w-xl", wide: "max-w-2xl", full: "" };
/** The longest line of a help text: it spans the card, but never wider than is comfortable to read. */
export const HELP = "max-w-[70ch] text-xs";
export function Labeled({ label, description, hint, children, htmlFor, className, control = "normal", }) {
    return (_jsxs(UiField, { className: cn("gap-2", className), children: [_jsx(FormFieldLabel, { htmlFor: htmlFor, className: "font-medium text-sm", children: label }), description && (_jsx(FormFieldDescription, { className: cn(HELP, "nth-last-2:mt-0"), children: description })), _jsx("div", { className: cn("w-full", CONTROL_WIDTH[control]), children: children }), hint && _jsx(FormFieldDescription, { className: HELP, children: hint })] }));
}
