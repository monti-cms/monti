"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button, Spinner } from "@monti-cms/admin/kit";
import { useTranslator } from "@monti-cms/core/client";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { aiCommonMessages } from "./ai-common.messages.js";
import { useAiAction } from "./use-ai-action.js";
/**
 * AI button for custom screens (plugin screens, field inputs, etc.). Renders nothing if the action is off or has no connection. `aiClient<typeof config>()` gives the
 * button with action names, inputs and results typed by the config.
 *
 * ```tsx
 * <AiButton action="summary" input={() => ({ title, body })} onResult={(result) => setSummary(result.text)} />
 * ```
 */
export function AiButton({ action, input, onResult, children, className, }) {
    const t = useTranslator(aiCommonMessages);
    const ai = useAiAction(action);
    const [running, setRunning] = useState(false);
    if (!ai.available)
        return null;
    const label = ai.action?.label ?? action;
    return (_jsxs(Button, { type: "button", variant: "outline", size: "sm", className: className, disabled: running, onClick: async () => {
            setRunning(true);
            try {
                onResult(await ai.run(input()));
            }
            catch (error) {
                toast.error(error instanceof Error && error.message ? error.message : t("runFailed"));
            }
            finally {
                setRunning(false);
            }
        }, children: [running ? _jsx(Spinner, {}) : _jsx(Sparkles, { "aria-hidden": true }), running ? t("running") : (children ?? label)] }));
}
