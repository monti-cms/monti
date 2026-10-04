"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
/**
 * Chart rendering slot. On the server and before loading, shows the chart source; in the browser, loads `recharts` (optional dependency)
 * and swaps it for the chart. If loading fails, the source is left as is.
 */
export function ChartClient({ source }) {
    const [View, setView] = useState(null);
    useEffect(() => {
        let disposed = false;
        import("./view.js")
            .then((module) => {
            if (!disposed)
                setView(() => module.ChartView);
        })
            .catch(() => { });
        return () => {
            disposed = true;
        };
    }, []);
    if (View)
        return _jsx(View, { source: source });
    return (_jsx("figure", { className: "cms-block-chart", "data-state": "loading", children: _jsx("pre", { className: "cms-block-chart-source", children: _jsx("code", { children: source }) }) }));
}
