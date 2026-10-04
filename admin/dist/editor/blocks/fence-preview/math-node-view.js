"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { blocksMessages } from "../messages.js";
import { FencePreviewNodeView } from "./fence-preview-node-view.js";
import { MathPreview } from "./preview-renderers.js";
const t = createTranslator(blocksMessages);
const MATH_META = {
    kind: "math",
    label: t("math.label"),
    placeholder: "E = mc^2",
    preview: (value) => _jsx(MathPreview, { value: value }),
};
/** Math block (`$$`) edit view. */
export function MathNodeView(props) {
    return _jsx(FencePreviewNodeView, { ...props, meta: MATH_META });
}
