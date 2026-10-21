import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { commonMessages } from "../../lib/common.messages.js";
import { cn } from "../../lib/utils/cn.js";
import { Alert, AlertDescription } from "../../ui/alert.js";
import { Button } from "../../ui/button.js";
/**
 * The one load-failure notice of a screen: what went wrong and a retry button. Give it margins through `className`: its width is `auto`, so margins
 * narrow it instead of pushing the retry button past the edge.
 */
export function LoadErrorAlert({ message, onRetry, className, }) {
    const t = useTranslator(commonMessages);
    return (_jsxs(Alert, { variant: "destructive", layout: "inline", className: cn("w-auto", className), children: [_jsx(AlertDescription, { className: "col-start-auto min-w-0", children: message }), onRetry && (_jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: onRetry, className: "shrink-0", children: t("retry") }))] }));
}
