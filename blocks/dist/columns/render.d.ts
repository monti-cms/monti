import type { DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { type PropsWithChildren } from "react";
/** Columns. Stacked vertically on narrow screens, and side by side on wide screens using the `widths` ratios (equal if absent). */
export declare function Columns({ widths, children, count }: PropsWithChildren<{
    widths?: string;
    count?: number;
}>): import("react").JSX.Element;
/** One column. It is a single element rather than a fragment, so each paragraph inside does not become its own cell. */
export declare function Column({ children }: PropsWithChildren): import("react").JSX.Element;
/** Public components for columns in the JSON renderer (`renderDocument`): the blocks `columns` and `column`. The columns are counted from the stored `column` nodes. */
export declare const documentComponents: (_context: DocumentComponentsContext) => LooseDocumentComponents;
