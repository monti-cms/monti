import type { PropsWithChildren } from "react";
/** Text color and text background color (`:color[text]{fg bg …}`). Non-hex values are dropped, and with no color only the text is rendered. */
export declare function Color({ children, ...attrs }: PropsWithChildren<Record<string, unknown>>): import("react").JSX.Element;
/** Public components for text color in the JSON renderer (`renderDocument`): the mark `color`. */
declare const _default: import("@monti-cms/core/render").RenderPlugin;
export default _default;
