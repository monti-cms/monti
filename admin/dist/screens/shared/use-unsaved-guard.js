"use client";
import { useTranslator } from "@monti-cms/core/client";
import { useEffect, useRef } from "react";
import { commonMessages } from "../../lib/common.messages.js";
import { useBeforeUnload } from "../../lib/hooks/use-before-unload.js";
import { discardConfirm, useConfirm } from "./confirm-dialog.js";
/**
 * Guards a screen with unsaved changes against leaving: the browser asks before a reload or a closed tab, and a click on a link inside the
 * admin asks with the same discard dialog the rest of the admin uses. Links inside an element marked `data-unsaved-guard="off"` are not a way out and pass. Render the returned `dialog` once on the screen.
 */
export function useUnsavedGuard(dirty) {
    const t = useTranslator(commonMessages);
    const { confirm, dialog } = useConfirm();
    const bypass = useRef(false);
    useBeforeUnload(dirty);
    useEffect(() => {
        if (!dirty)
            return;
        const onClick = (event) => {
            if (bypass.current || event.defaultPrevented || event.button !== 0)
                return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                return;
            const anchor = event.target?.closest?.("a[href]");
            if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download"))
                return;
            // Links that only move within the screen (its tabs) keep the draft, so they are not a way out.
            if (anchor.closest("[data-unsaved-guard='off']"))
                return;
            const url = new URL(anchor.href, window.location.href);
            if (url.origin !== window.location.origin)
                return;
            // A change of the hash only stays on the page.
            if (url.pathname === window.location.pathname && url.search === window.location.search)
                return;
            event.preventDefault();
            event.stopPropagation();
            void confirm(discardConfirm(t)).then((ok) => {
                if (!ok)
                    return;
                // Click again with the guard off, so the host's router does the navigation as it would have.
                bypass.current = true;
                anchor.click();
                bypass.current = false;
            });
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [dirty, confirm, t]);
    return { dialog };
}
