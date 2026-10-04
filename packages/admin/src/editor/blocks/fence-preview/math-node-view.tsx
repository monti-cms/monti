"use client";

import { createTranslator } from "@monti-cms/core/client";
import type { NodeViewProps } from "@tiptap/react";
import { blocksMessages } from "../messages";
import { type FenceEditorMeta, FencePreviewNodeView } from "./fence-preview-node-view";
import { MathPreview } from "./preview-renderers";

const t = createTranslator(blocksMessages);

const MATH_META: FenceEditorMeta = {
	kind: "math",
	label: t("math.label"),
	placeholder: "E = mc^2",
	preview: (value) => <MathPreview value={value} />,
};

/** Math block (`$$`) edit view. */
export function MathNodeView(props: NodeViewProps) {
	return <FencePreviewNodeView {...props} meta={MATH_META} />;
}
