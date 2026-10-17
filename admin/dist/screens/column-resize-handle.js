import { jsx as _jsx } from "react/jsx-runtime";
// Column width resize handle of the entries table header.
import { useTranslator } from "@monti-cms/core/site";
import { cn } from "../lib/utils/cn.js";
import { MAX_COLUMN_SIZE, MIN_COLUMN_SIZE } from "./entries-table-widths.js";
import { screensMessages } from "./messages.js";
/**
 * Column width resize handle. Drag the header's right edge, or focus it and press ←/→ to change by 16px. Pressing twice resets to the default width.
 */
export function ColumnResizeHandle({ label, width, resizing, onStart, onNudge, onReset, }) {
    const t = useTranslator(screensMessages);
    return (_jsx("div", { role: "separator", "aria-orientation": "vertical", "aria-label": t("list.resizeColumn", { label }), "aria-valuenow": width, "aria-valuemin": MIN_COLUMN_SIZE, "aria-valuemax": MAX_COLUMN_SIZE, "aria-valuetext": `${width}px`, tabIndex: 0, onMouseDown: onStart, onTouchStart: onStart, onDoubleClick: onReset, onKeyDown: (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                onNudge(event.key === "ArrowLeft" ? -16 : 16);
            }
        }, className: "absolute top-0 right-0 z-10 flex h-full w-2 cursor-col-resize touch-none select-none justify-center outline-none", children: _jsx("span", { className: cn("h-full w-px bg-transparent transition-colors group-hover/th:bg-monti-border", resizing && "bg-monti-primary group-hover/th:bg-monti-primary", "[div:focus-visible>&]:bg-monti-ring") }) }));
}
