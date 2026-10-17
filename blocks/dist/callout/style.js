import { AlertCircle, AlertOctagon, AlertTriangle, Info, Lightbulb } from "lucide-react";
/** Callout icon in the editor. The public page look is decided by the site's renderer. */
export const CALLOUT_ICON_BY_VARIANT = {
    note: AlertCircle,
    tip: Lightbulb,
    info: Info,
    warning: AlertTriangle,
    danger: AlertOctagon,
};
const TITLE_BY_VARIANT = {
    note: "NOTE",
    tip: "TIP",
    info: "INFO",
    warning: "WARNING",
    danger: "DANGER",
};
/**
 * Look of the callout box in the editor. The color mixes the per-variant (`data-variant`) accent color into the theme background and border (this package's `styles.css`
 * `.monti-callout`, accent color variable `--monti-callout-<variant>`). The public callout is drawn by the site.
 */
export const CALLOUT_BOX_CLASS = [
    "monti-callout relative block w-full rounded-lg border px-4 py-3 text-sm",
    "[&>svg]:size-4 [&>svg]:translate-y-0.5",
].join(" ");
/** Default title shown dimmed in the editor when the title is empty. */
export const getDefaultCalloutTitle = (variant) => TITLE_BY_VARIANT[variant];
