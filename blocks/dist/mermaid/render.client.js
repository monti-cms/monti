"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from "react";
/** Whether the document is in the dark theme (the `dark` class or `data-theme="dark"` on `html`, else the system setting). */
const isDarkDocument = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark") || root.dataset.theme === "dark")
        return true;
    if (root.classList.contains("light") || root.dataset.theme === "light")
        return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
};
/** Whether the document uses the dark theme. Re-read when the theme changes. */
function useDarkTheme() {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const read = () => setDark(isDarkDocument());
        read();
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
        return () => observer.disconnect();
    }, []);
    return dark;
}
/**
 * Mermaid diagram (` ```mermaid `). On the server and before loading it shows the source, then loads `mermaid` (optional dependency) in the browser and
 * turns it into a diagram. If loading fails or the syntax is wrong, the source and the error text stay as they are. Redrawn when the theme changes.
 */
export function MermaidView({ source }) {
    const baseId = useId().replace(/[^\w-]/g, "");
    const counter = useRef(0);
    const dark = useDarkTheme();
    const [state, setState] = useState(null);
    useEffect(() => {
        if (!source.trim())
            return;
        let disposed = false;
        (async () => {
            try {
                const { default: mermaid } = await import("mermaid");
                mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
                counter.current += 1;
                const { svg } = await mermaid.render(`cms-mermaid-${baseId}-${counter.current}`, source);
                if (!disposed)
                    setState({ svg });
            }
            catch (error) {
                if (!disposed)
                    setState({ error: error instanceof Error ? error.message : "Mermaid render error" });
            }
        })();
        return () => {
            disposed = true;
        };
    }, [source, dark, baseId]);
    const svg = state && "svg" in state ? state.svg : null;
    const error = state && "error" in state ? state.error : null;
    return (_jsxs("figure", { className: "cms-block-mermaid", "data-state": svg ? "ready" : error ? "error" : "loading", children: [svg ? (_jsx("div", { className: "cms-block-mermaid-diagram", dangerouslySetInnerHTML: { __html: svg } })) : (_jsx("pre", { className: "cms-block-mermaid-source", children: _jsx("code", { children: source }) })), error ? _jsx("figcaption", { className: "cms-block-mermaid-error", children: error }) : null] }));
}
