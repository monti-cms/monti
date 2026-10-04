"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { useLayoutEffect, useRef, useState } from "react";
import { sharedMessages } from "./messages.js";
const t = createTranslator(sharedMessages);
const GAP = 4;
const CHIP = "shrink-0 rounded bg-cms-muted px-1.5 py-0.5 text-cms-muted-foreground text-xs";
/**
 * Shows as many tags as fit the cell width and shortens the rest to `+N`. Remeasures when the column width changes.
 * Draws all tags and the longest `+N` in an invisible measuring row and measures the width. If none fit, the first tag is truncated with an ellipsis.
 */
export function FittingTags({ tags }) {
    const boxRef = useRef(null);
    const measureRef = useRef(null);
    const [shown, setShown] = useState(tags.length);
    const key = tags.map((tag) => tag.id).join();
    // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands in for the contents of the tag list
    useLayoutEffect(() => {
        const box = boxRef.current;
        const measure = measureRef.current;
        if (!box || !measure)
            return;
        const measureFit = () => {
            const width = box.clientWidth;
            const chips = [...measure.children];
            const plus = chips.pop()?.offsetWidth ?? 0;
            const widths = chips.map((chip) => chip.offsetWidth);
            const total = widths.reduce((sum, chipWidth, index) => sum + chipWidth + (index > 0 ? GAP : 0), 0);
            if (width === 0 || total <= width) {
                setShown(widths.length);
                return;
            }
            let used = 0;
            let count = 0;
            for (const chipWidth of widths) {
                const next = used + (count > 0 ? GAP : 0) + chipWidth;
                if (next + GAP + plus > width)
                    break;
                used = next;
                count += 1;
            }
            setShown(Math.max(1, count));
        };
        measureFit();
        if (typeof ResizeObserver === "undefined")
            return;
        const observer = new ResizeObserver(measureFit);
        observer.observe(box);
        return () => observer.disconnect();
    }, [key]);
    const hidden = tags.length - shown;
    return (_jsxs("span", { ref: boxRef, className: "relative flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap", title: tags.map((tag) => tag.title).join(", "), children: [tags.slice(0, shown).map((tag, index) => (_jsx("span", { className: index === 0 && hidden > 0 ? `${CHIP} min-w-0 shrink truncate` : CHIP, children: tag.title }, tag.id))), hidden > 0 && (_jsxs("span", { className: "shrink-0 text-cms-muted-foreground text-xs", children: [_jsxs("span", { "aria-hidden": true, children: ["+", hidden] }), _jsx("span", { className: "sr-only", children: t("tags.more", { count: hidden }) })] })), _jsxs("span", { ref: measureRef, "aria-hidden": true, className: "pointer-events-none invisible absolute top-0 left-0 flex gap-1", children: [tags.map((tag) => (_jsx("span", { className: CHIP, children: tag.title }, tag.id))), _jsxs("span", { className: "text-xs", children: ["+", tags.length] })] })] }));
}
