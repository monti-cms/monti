"use client";

import { useTranslator } from "@monti-cms/core/client";
import type { TranslatorFor } from "../../../translator";
import { blocksMessages } from "../messages";
import { type FenceEditorMeta, FencePreviewBlockView } from "./fence-preview-node-view";
import { MathPreview } from "./preview-renderers";

const mathMeta = (t: TranslatorFor<typeof blocksMessages>): FenceEditorMeta => ({
	kind: "math",
	label: t("math.label"),
	placeholder: "E = mc^2",
	preview: (value) => <MathPreview value={value} />,
});

/** Edit view of the core math block (`blockViews.math`, `$$`). */
export function MathBlockView() {
	const t = useTranslator(blocksMessages);
	return <FencePreviewBlockView meta={mathMeta(t)} />;
}
