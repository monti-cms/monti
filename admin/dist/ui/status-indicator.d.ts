import type * as React from "react";
/** What a status means; the color follows from it (`--cms-success`, `--cms-warning`, `--cms-destructive`, muted). */
export type StatusTone = "success" | "warning" | "destructive" | "neutral";
/** The marker's form. The meaning never rests on color alone: pair the shape with a `label`, or give the marker a name some other way. */
export type StatusShape = "dot" | "ring" | "dashed" | "half" | "minus";
/**
 * The one status marker of the admin: a small shape in a tone, usually followed by its name. Entry status, delivery state, locale presence,
 * the save status and the language tabs all use it, so a state looks the same wherever it appears.
 */
export declare function StatusIndicator({ tone, shape, size, label, labelClassName, pulse, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & {
    tone?: StatusTone;
    shape?: StatusShape;
    size?: "xs" | "sm" | "md";
    /** The status name next to the marker. Without it the marker is decorative (`aria-hidden`). */
    label?: string;
    /** Classes of the label, e.g. `hidden lg:inline` to keep it for wide screens (it stays readable to screen readers only when it is not `hidden`: set `aria-label` on the parent then). */
    labelClassName?: string;
    /** Breathes while the status is in progress. */
    pulse?: boolean;
}): React.JSX.Element;
