import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Button } from "./button.js";
/**
 * An icon-only button. `label` is both the screen reader name and the tooltip shown on hover (the two are always the same).
 * With `pressed` it becomes a toggle button and has a background while on.
 * For a button that opens a menu or popover, wrap it with `trigger`: `trigger={(button) => <PopoverTrigger render={button} />}`.
 */
export declare function IconButton({ label, pressed, destructive, side, size, variant, className, trigger, children, ...props }: Omit<ComponentProps<typeof Button>, "aria-label" | "aria-pressed" | "children"> & {
    label: string;
    pressed?: boolean;
    destructive?: boolean;
    side?: "top" | "bottom" | "left" | "right";
    trigger?: (button: ReactElement) => ReactElement;
    children: ReactNode;
}): import("react").JSX.Element;
