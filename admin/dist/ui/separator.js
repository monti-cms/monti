"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "../lib/utils/index.js";
function Separator({ className, orientation = "horizontal", ...props }) {
    return (_jsx(SeparatorPrimitive, { "data-slot": "separator", orientation: orientation, className: cn("monti-horizontal:h-px monti-horizontal:w-full monti-vertical:w-px shrink-0 monti-vertical:self-stretch bg-monti-border", className), ...props }));
}
export { Separator };
