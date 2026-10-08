import { jsx as _jsx } from "react/jsx-runtime";
import { cleanTextColor, textColorProps } from "./colors.js";
/** Text color and text background color (`:color[text]{fg bg …}`). Non-hex values are dropped, and with no color only the text is rendered. */
export function Color({ children, ...attrs }) {
    const { className, style, ...data } = textColorProps(cleanTextColor(attrs));
    return (_jsx("span", { className: className, style: style, ...data, children: children }));
}
/** Public components for text color in the JSON renderer (`renderDocument`): the mark `color`. */
export const documentComponents = (_context) => ({
    marks: {
        color: ({ children, ctx: _ctx, ...attrs }) => (_jsx(Color, { ...attrs, children: children })),
    },
});
