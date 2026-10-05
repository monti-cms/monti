/** Model for code block annotations (highlight and fold rules). Shared by the editor and the public renderer. */

export {
	annotationConfig,
	CODE_BLOCK_FEATURES,
	CODE_BLOCK_THEMES,
	CODE_LINE_EFFECTS,
	EXTRA_CODE_LANGUAGES,
	isLineEffectName,
	lineEffectDefinition,
	OFFERED_LINE_EFFECTS,
	offersCharEffect,
} from "./annotation/code-block/active";
export { fromCodeFenceToCodeBlockDocument, parseCodeFenceMeta } from "./annotation/code-block/code-fence-to-document";
export * from "./annotation/code-block/constants";
export { fromCodeBlockDocumentToCodeFence } from "./annotation/code-block/document-to-code-fence";
export { createAnnotationRegistry, supportsAnnotationScope } from "./annotation/code-block/libs";
export * from "./annotation/code-block/line-effects";
export * from "./annotation/code-block/model";
export * from "./annotation/code-block/types";
