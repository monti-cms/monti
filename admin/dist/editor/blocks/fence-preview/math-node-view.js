"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { blocksMessages } from "../messages.js";
import { FencePreviewBlockView } from "./fence-preview-node-view.js";
import { MathPreview } from "./preview-renderers.js";
const mathMeta = (t) => ({
    kind: "math",
    label: t("math.label"),
    placeholder: "E = mc^2",
    preview: (value) => _jsx(MathPreview, { value: value }),
});
/** Edit view of the core math block (`blockViews.math`, `$$`). */
export function MathBlockView() {
    const t = useTranslator(blocksMessages);
    return _jsx(FencePreviewBlockView, { meta: mathMeta(t) });
}
