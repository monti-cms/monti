"use client";

import { createTranslator } from "@monti-cms/core/client";
import { blocksMessages } from "../messages";
import { type FenceEditorMeta, FencePreviewBlockView } from "./fence-preview-node-view";
import { MathPreview } from "./preview-renderers";

const t = createTranslator(blocksMessages);

const MATH_META: FenceEditorMeta = {
	kind: "math",
	label: t("math.label"),
	placeholder: "E = mc^2",
	preview: (value) => <MathPreview value={value} />,
};

/** Edit view of the core math block (`blockViews.math`, `$$`). */
export function MathBlockView() {
	return <FencePreviewBlockView meta={MATH_META} />;
}
