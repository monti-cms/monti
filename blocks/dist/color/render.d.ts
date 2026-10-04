import type { PropsWithChildren } from "react";
/** Text color and text background color (`:color[text]{fg bg …}`). Non-hex values are dropped, and with no color only the text is rendered. */
export declare function Color({ children, ...attrs }: PropsWithChildren<Record<string, unknown>>): import("react").JSX.Element;
export default _default;
/** Public component for text color (called by `@monti-cms/core/render`). The color is picked for the theme by `.cms-color` in `styles.css`. */
declare function _default(): {
    Color: typeof Color;
};
