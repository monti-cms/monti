export * from "@monti-cms/core/code-block";
export { cmsCodeBlock } from "./code-block-extension";
export { CodeBlockView } from "./code-block-view";
export { CodeFoldMark } from "./code-fold-mark";
export { codeEffectsKey, createCodeEffectsPlugin, foldRegions, setFoldOpen } from "./effects-plugin";
export { codeBlockHighlightPluginKey, createCodeBlockHighlightPlugin, getShikiHighlighter } from "./highlight-plugin";
export {
	createCodeBlockKeysPlugin,
	findCodeBlockDepth,
	handleEnterKey,
	handleModAKey,
	handlePaste,
	handleTabKey,
	isComposing,
	isInCodeBlock,
} from "./keys";
export { CODE_LANGUAGE_OPTIONS, codeLanguageChoices } from "./languages";
export { formatMeta, parseMeta } from "./meta";
export type { CodeLanguageOption, ParsedCodeBlockMeta } from "./types";
