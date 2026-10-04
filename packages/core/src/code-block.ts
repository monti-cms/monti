/** 코드 블록 주석(강조·접기 규칙) 모델. 편집기와 공개 렌더러가 함께 쓴다. */

export {
	annotationConfig,
	CODE_LINE_EFFECTS,
	isLineEffectName,
	lineEffectDefinition,
} from "./annotation/code-block/active";
export { fromCodeFenceToCodeBlockDocument, parseCodeFenceMeta } from "./annotation/code-block/code-fence-to-document";
export * from "./annotation/code-block/constants";
export { fromCodeBlockDocumentToCodeFence } from "./annotation/code-block/document-to-code-fence";
export { createAnnotationRegistry, supportsAnnotationScope } from "./annotation/code-block/libs";
export * from "./annotation/code-block/line-effects";
export * from "./annotation/code-block/model";
export * from "./annotation/code-block/types";
