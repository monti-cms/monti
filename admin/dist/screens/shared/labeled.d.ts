import type { ReactNode } from "react";
/** How wide the control of a field is: short values and choices stay narrow, text takes more, a list or a row of controls takes the whole width. */
export declare const CONTROL_WIDTH: {
    readonly narrow: "max-w-sm";
    readonly normal: "max-w-xl";
    readonly wide: "max-w-2xl";
    readonly full: "";
};
/** The longest line of a help text: it spans the card, but never wider than is comfortable to read. */
export declare const HELP = "max-w-[70ch] text-xs";
export declare function Labeled({ label, description, hint, children, htmlFor, className, control, }: {
    label: ReactNode;
    /** A field description explaining what the setting is, placed between label and control. */
    description?: ReactNode;
    /** An input hint or helper text, placed beneath the control. */
    hint?: ReactNode;
    htmlFor?: string;
    children: ReactNode;
    className?: string;
    control?: keyof typeof CONTROL_WIDTH;
}): import("react").JSX.Element;
