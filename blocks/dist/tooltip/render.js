import { jsx as _jsx } from "react/jsx-runtime";
import { defineRender } from "@monti-cms/core/render";
import { Tooltip } from "./render.client.js";
export { Tooltip };
/**
 * Public components for the tooltip in the JSON renderer (`renderDocument`): the mark `tooltip`, and the code tag `Tooltip` that draws a tooltip inside a
 * code block (a text effect). Both show the same component.
 */
export default defineRender({
    marks: {
        tooltip: ({ content, children }) => (_jsx(Tooltip, { content: content, children: children })),
    },
    codeTags: { Tooltip },
});
