"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { Component, useEffect, useState } from "react";
import { useCmsAdminComponents } from "../../../admin-components.js";
import { cn } from "../../../lib/utils/cn.js";
import { blocksMessages } from "../messages.js";
export class PreviewErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("Preview render error:", error, errorInfo);
    }
    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }
    render() {
        if (this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback(this.state.error);
            }
            return (_jsx("div", { className: "rounded-md border border-cms-destructive/40 bg-cms-destructive/10 p-3 font-mono text-cms-destructive text-xs", children: this.state.error.message }));
        }
        return this.props.children;
    }
}
/**
 * Loads and renders the fence preview the site provided (`CmsAdminComponents.fencePreviews`). If none was provided, shows the raw source as is.
 */
export function LazyFencePreview({ lang, label, value, className, emptyText, }) {
    const t = useTranslator(blocksMessages);
    const load = useCmsAdminComponents().fencePreviews?.[lang];
    const [Renderer, setRenderer] = useState(null);
    const [loadError, setLoadError] = useState(null);
    useEffect(() => {
        if (!load)
            return;
        let cancelled = false;
        load()
            .then((component) => {
            if (!cancelled)
                setRenderer(() => component);
        })
            .catch((err) => {
            if (!cancelled)
                setLoadError(err instanceof Error ? err.message : String(err));
        });
        return () => {
            cancelled = true;
        };
    }, [load]);
    const trimmed = value.trim();
    if (!load) {
        return (_jsx("pre", { className: cn("overflow-x-auto whitespace-pre-wrap font-mono text-cms-muted-foreground text-xs", className), children: trimmed || emptyText }));
    }
    if (loadError) {
        return (_jsx("div", { className: "rounded-md border border-cms-destructive/40 bg-cms-destructive/10 p-3 font-mono text-cms-destructive text-xs", children: t("preview.loadFailed", { label, error: loadError }) }));
    }
    if (!Renderer) {
        return _jsx("div", { className: "py-2 text-center text-cms-muted-foreground text-xs", children: t("preview.loading", { label }) });
    }
    if (!trimmed) {
        return _jsx("div", { className: "py-2 text-center text-cms-muted-foreground text-xs italic", children: emptyText });
    }
    return (_jsx(PreviewErrorBoundary, { resetKey: trimmed, children: _jsx("div", { className: cn("w-full min-w-0 overflow-x-auto [&_[data-error=true]]:text-cms-destructive [&_[data-error=true]_span]:text-cms-destructive", className), children: _jsx(Renderer, { source: trimmed }) }) }));
}
export function MathPreview({ value, className }) {
    const t = useTranslator(blocksMessages);
    const trimmed = value.trim();
    const [html, setHtml] = useState("");
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        if (!trimmed) {
            setHtml("");
            setError(null);
            return;
        }
        import("katex")
            .then((katexModule) => {
            if (cancelled)
                return;
            try {
                const katex = katexModule.default ?? katexModule;
                const rendered = katex.renderToString(trimmed, {
                    displayMode: true,
                    throwOnError: true,
                });
                setHtml(rendered);
                setError(null);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                setHtml("");
            }
        })
            .catch((err) => {
            if (!cancelled) {
                setError(err instanceof Error ? err.message : String(err));
                setHtml("");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [trimmed]);
    if (error) {
        return (_jsx("div", { className: "rounded-md border border-cms-destructive/40 bg-cms-destructive/10 p-3 font-mono text-cms-destructive text-xs", children: error }));
    }
    if (!value.trim()) {
        return _jsx("div", { className: "py-2 text-center text-cms-muted-foreground text-xs italic", children: t("math.placeholder") });
    }
    return (_jsx(PreviewErrorBoundary, { resetKey: trimmed, children: _jsx("div", { className: cn("overflow-x-auto py-2 text-center", className), 
            // biome-ignore lint/security/noDangerouslySetInnerHtml: katex produces safe display math markup
            dangerouslySetInnerHTML: { __html: html } }) }));
}
