import type { ComponentProps } from "react";
/**
 * The body of a settings or tools page: left-aligned under the page header, one maximum width and one padding, so no page can drift from the others.
 * Cards inside it take the full width; their texts keep a readable measure on their own. A form-like page keeps the readable width; a `wide` page
 * (a workspace of lists, trees and side panels) uses all the width there is, with the same padding.
 */
export declare function PageBody({ className, wide, ...props }: ComponentProps<"div"> & {
    wide?: boolean;
}): import("react").JSX.Element;
