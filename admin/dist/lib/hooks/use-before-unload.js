"use client";
import { useEffect } from "react";
/** While `active`, the browser asks before the page is reloaded or closed. */
export function useBeforeUnload(active) {
    useEffect(() => {
        if (!active)
            return;
        const warn = (event) => {
            event.preventDefault();
            // Some browsers show their own text and only need the property to be set.
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [active]);
}
