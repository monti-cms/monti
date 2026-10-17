import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../lib/utils/index.js";
function Textarea({ className, ...props }) {
    return (_jsx("textarea", { "data-slot": "textarea", className: cn("field-sizing-content flex min-h-16 w-full rounded-md border border-monti-input bg-transparent monti-dark:bg-monti-input/30 px-2.5 py-2 text-base outline-none transition-[color,box-shadow] placeholder:text-monti-muted-foreground focus-visible:border-monti-ring focus-visible:ring-3 focus-visible:ring-monti-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-monti-destructive monti-dark:aria-invalid:border-monti-destructive/50 aria-invalid:ring-3 aria-invalid:ring-monti-destructive/20 monti-dark:aria-invalid:ring-monti-destructive/40 md:text-sm", className), ...props }));
}
export { Textarea };
