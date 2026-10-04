import { jsx as _jsx } from "react/jsx-runtime";
import { cleanTextColor, textColorProps } from "./colors.js";
/** Text color and text background color (`:color[text]{fg bg …}`). Non-hex values are dropped, and with no color only the text is rendered. */
export function Color({ children, ...attrs }) {
    const { className, style, ...data } = textColorProps(cleanTextColor(attrs));
    return (_jsx("span", { className: className, style: style, ...data, children: children }));
}
/** Public component for text color (called by `@monti-cms/core/render`). The color is picked for the theme by `.cms-color` in `styles.css`. */
export default () => ({ Color });
