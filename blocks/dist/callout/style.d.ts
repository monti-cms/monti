import type { ComponentType } from "react";
/** Callout block variants (the options of the block definition's `callout.variant`). */
export type CalloutVariant = "note" | "tip" | "info" | "warning" | "danger";
/** Callout icon in the editor. The public page look is decided by the site's renderer. */
export declare const CALLOUT_ICON_BY_VARIANT: Record<CalloutVariant, ComponentType<{
    className?: string;
}>>;
/**
 * Look of the callout box in the editor. The color mixes the per-variant (`data-variant`) accent color into the theme background and border (this package's `styles.css`
 * `.cms-callout`, accent color variable `--cms-callout-<variant>`). The public callout is drawn by the site.
 */
export declare const CALLOUT_BOX_CLASS: string;
/** Default title shown dimmed in the editor when the title is empty. */
export declare const getDefaultCalloutTitle: (variant: CalloutVariant) => string;
