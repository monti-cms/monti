"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
/** Code copy button. After copying, it briefly shows `copiedLabel`. */
export function CmsCopyButton({ text, label, copiedLabel }) {
    const [copied, setCopied] = useState(false);
    return (_jsx("button", { type: "button", className: "cms-code-copy", "aria-label": label, onClick: async () => {
            if (copied)
                return;
            try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
            }
            catch {
                // Do nothing where the clipboard is unavailable (permissions, http).
            }
        }, children: copied ? copiedLabel : label }));
}
