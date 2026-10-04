import { AlertCircle, AlertOctagon, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { ComponentType } from "react";

/** Callout block variants (the options of the block definition's `callout.variant`). */
export type CalloutVariant = "note" | "tip" | "info" | "warning" | "danger";

/** Callout icon in the editor. The public page look is decided by the site's renderer. */
export const CALLOUT_ICON_BY_VARIANT: Record<CalloutVariant, ComponentType<{ className?: string }>> = {
	note: AlertCircle,
	tip: Lightbulb,
	info: Info,
	warning: AlertTriangle,
	danger: AlertOctagon,
};

const TITLE_BY_VARIANT: Record<CalloutVariant, string> = {
	note: "NOTE",
	tip: "TIP",
	info: "INFO",
	warning: "WARNING",
	danger: "DANGER",
};

/**
 * Look of the callout box in the editor. The color mixes the per-variant (`data-variant`) accent color into the theme background and border (this package's `styles.css`
 * `.cms-callout`, accent color variable `--cms-callout-<variant>`). The public callout is drawn by the site.
 */
export const CALLOUT_BOX_CLASS = [
	"cms-callout relative block w-full rounded-lg border px-4 py-3 text-sm",
	"[&>svg]:size-4 [&>svg]:translate-y-0.5",
].join(" ");

/** Default title shown dimmed in the editor when the title is empty. */
export const getDefaultCalloutTitle = (variant: CalloutVariant) => TITLE_BY_VARIANT[variant];
