import { jsx as _jsx } from "react/jsx-runtime";
import { translate } from "@monti-cms/core";
import { defineRender } from "@monti-cms/core/render";
import { codeRefMessages } from "./messages.js";
import { CodeRef } from "./render.client.js";
export { CodeRef };
const labelsFor = (locale) => {
    const language = (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
    return { back: translate(codeRefMessages, language, "back") };
};
/** Public components for code-ref in the JSON renderer (`renderDocument`): the mark `code-ref`. */
export default defineRender({
    marks: {
        "code-ref": ({ to, children, ctx }) => (_jsx(CodeRef, { to: to, labels: labelsFor(ctx.locale), children: children })),
    },
});
