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

/** 수식 블록(`$$`) 편집 화면. */
export function MathNodeView(props: NodeViewProps) {
	return <FencePreviewNodeView {...props} meta={MATH_META} />;
}
