import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { commonMessages } from "../../lib/common.messages.js";
import { Alert, AlertDescription } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
/** The one load-failure notice of a screen: what went wrong and a retry button. Give it margins through `className`. */
export function LoadErrorAlert({ message, onRetry, className, }) {
    const t = useTranslator(commonMessages);
    return (_jsxs(Alert, { variant: "destructive", layout: "inline", className: className, children: [_jsx(AlertDescription, { className: "col-start-auto", children: message }), onRetry && (_jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: onRetry, children: t("retry") }))] }));
}
