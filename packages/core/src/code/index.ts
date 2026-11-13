/**
 * `@monti-cms/core/code`: code blocks (doc 17). The site opens `codeHighlighter(config.codeBlock)` once and gives it to `renderDocument` as `code`; the
 * editor uses the same colours. The MDX plugin reads and writes fences with `readFence` and `writeFence`.
 */
export { codeLineId } from "./draw";
export {
	type CodeColors,
	type CodeToken,
	codeHighlighter,
	colorsOf,
	knownLanguage,
	languageName,
	loadLanguage,
} from "./highlight";
export { brokenCodeRefs, type CodeRef, codeBlocksByRef, resolveCodeRef } from "./links";
export { commentSyntax, contentOf, readFence, readMeta, writeFence, writeMeta } from "./notation";
export {
	CORE_LINE_EFFECTS,
	type CodeBlockConfig,
	type CodeBlockSettings,
	type CodeLineEffectDefinition,
	codeBlockSettings,
	DEFAULT_CODE_LANGUAGES,
	DEFAULT_CODE_THEMES,
} from "./settings";
export {
	ANCHOR,
	CODE_TEXT_EFFECTS,
	COLLAPSE,
	type CodeBlockAttrs,
	type CodeRule,
	type CodeTextEffect,
	codeOf,
	codeProblems,
	type LineEffect,
	lineStarts,
	moveLineEffects,
	moveLineRules,
	ruleRanges,
	ruleRegex,
} from "./shape";
