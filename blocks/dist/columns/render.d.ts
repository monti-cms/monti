import { type PropsWithChildren } from "react";
/** Columns. Stacked vertically on narrow screens, and side by side on wide screens using the `widths` ratios (equal if absent). */
export declare function Columns({ widths, children }: PropsWithChildren<{
    widths?: string;
}>): import("react").JSX.Element;
/** One column. It is a single element rather than a fragment, so each paragraph inside does not become its own cell. */
export declare function Column({ children }: PropsWithChildren): import("react").JSX.Element;
export default _default;
/** Public component for columns (called by `@monti-cms/core/render`). */
declare function _default(): {
    Columns: typeof Columns;
    Column: typeof Column;
};
