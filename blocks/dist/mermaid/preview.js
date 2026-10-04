"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@monti-cms/admin/kit";
import { useEffect, useRef, useState } from "react";
/**
 * Default editor preview of the Mermaid block (optional dependency `mermaid`). The Mermaid block extension's admin provider registers it as `fencePreviews.mermaid`,
 * and it is loaded only when a preview is opened. A site can replace it by registering its own renderer under the same name.
 * The theme follows the `dark` class on the document (`html`) and is redrawn when it changes.
 */
const isDark = (element) => Boolean(element?.closest(".dark")) || document.documentElement.classList.contains("dark");
/** Whether the document uses the dark theme. Re-read when the class on `html` changes. */
function useDarkTheme(ref) {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const read = () => setDark(isDark(ref.current));
        read();
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, [ref]);
    return dark;
}
let renderCount = 0;
export function MermaidPreview({ source, className }) {
    const wrapper = useRef(null);
    const target = useRef(null);
    const [error, setError] = useState(null);
    const dark = useDarkTheme(wrapper);
    useEffect(() => {
        if (!source.trim())
            return;
        let disposed = false;
        import("mermaid")
            .then(async ({ default: mermaid }) => {
            mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" });
            renderCount += 1;
            const { svg } = await mermaid.render(`cms-mermaid-${renderCount}`, source);
            if (disposed || !target.current)
                return;
            target.current.innerHTML = svg;
            setError(null);
        })
            .catch((reason) => {
            if (!disposed)
                setError(reason instanceof Error ? reason.message : String(reason));
        });
        return () => {
            disposed = true;
        };
    }, [source, dark]);
    return (_jsxs("div", { ref: wrapper, className: cn("flex justify-center overflow-x-auto p-4", className), "data-error": !!error, children: [_jsx("div", { ref: target, className: "flex w-full justify-center [&_svg]:h-auto [&_svg]:max-w-full" }), error && _jsxs("span", { className: "text-sm", children: ["ERROR : ", error] })] }));
}
