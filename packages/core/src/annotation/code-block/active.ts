// Set the dictionary language first so labels (`label`) know the UI language.
import "../../i18n";
import { cmsConfig } from "../../config/resolved";
import { createAnnotationConfig } from "./constants";
import {
	type CodeBlockFeatures,
	type CodeBlockThemes,
	type CodeLineEffectDefinition,
	DEFAULT_CODE_BLOCK_THEMES,
	resolveCodeLineEffects,
} from "./line-effects";
import { ANCHOR, COLLAPSE, type CodeLineEffectName } from "./model";

/** Line effects the site uses (core defaults + the site config's `codeBlock.lineEffects`). Editor menu order. */
export const CODE_LINE_EFFECTS = resolveCodeLineEffects(cmsConfig.codeBlock?.lineEffects);

/** Code fence comment config the site uses. Used by storage syntax conversion and the public renderer (`remarkAnnotationToShikiDecoration`). */
export const annotationConfig = createAnnotationConfig(CODE_LINE_EFFECTS);

/** A line effect definition. `undefined` for an unknown name. */
export const lineEffectDefinition = (name: string) => CODE_LINE_EFFECTS.find((effect) => effect.name === name);

/** Whether this is a line effect name the editor knows (effects in the definition list plus line folding and the body-link label). */
export const isLineEffectName = (name: string): name is CodeLineEffectName =>
	name === COLLAPSE || name === ANCHOR || CODE_LINE_EFFECTS.some((effect) => effect.name === name);

const omittedLineEffects = new Set(cmsConfig.codeBlock?.omitLineEffects ?? []);

/** Line effects the editor offers, in menu order (`CODE_LINE_EFFECTS` without the site's `codeBlock.omitLineEffects`). */
export const OFFERED_LINE_EFFECTS: readonly CodeLineEffectDefinition[] = CODE_LINE_EFFECTS.filter(
	(effect) => !omittedLineEffects.has(effect.name),
);

/** Code block tools the editor offers (the site's `codeBlock.features`; all on by default). Bodies that use a tool that is off still render. */
export const CODE_BLOCK_FEATURES: Required<CodeBlockFeatures> = {
	rules: true,
	fold: true,
	tooltip: true,
	textStyles: true,
	...cmsConfig.codeBlock?.features,
};

/** Whether the editor offers a text effect (a `CODE_CHAR_EFFECTS` name: `strong`, `em`, `del`, `u`, `Tooltip`, `fold`). */
export const offersCharEffect = (name: string): boolean =>
	name === "fold"
		? CODE_BLOCK_FEATURES.fold
		: name === "Tooltip"
			? CODE_BLOCK_FEATURES.tooltip
			: CODE_BLOCK_FEATURES.textStyles;

/** Highlighting themes of the site (Shiki theme names), for the public page and the editor. */
export const CODE_BLOCK_THEMES: CodeBlockThemes = cmsConfig.codeBlock?.themes ?? DEFAULT_CODE_BLOCK_THEMES;

/** Languages the site adds to the default list (`codeBlock.languages`). */
export const EXTRA_CODE_LANGUAGES: readonly string[] = cmsConfig.codeBlock?.languages ?? [];
