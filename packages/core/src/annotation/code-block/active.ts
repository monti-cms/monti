import { resolveLabels } from "../../i18n/active";
import { createAnnotationConfig } from "./constants";
import {
	type CodeBlockConfig,
	type CodeBlockFeatures,
	type CodeBlockThemes,
	type CodeLineEffectDefinition,
	DEFAULT_CODE_BLOCK_THEMES,
	resolveCodeLineEffects,
} from "./line-effects";
import { ANCHOR, COLLAPSE, type CodeLineEffectName } from "./model";

/** The code block settings of one site. */
export type SiteCodeBlock = ReturnType<typeof createCodeBlock>;

/**
 * The code block rules of a site config's `codeBlock`: the line effects, the editor tools, the themes and the languages. The labels of the line effects
 * (getters in `line-effects.ts`) are read once, in the language the caller has set (`createSite` does it for the admin language).
 */
export function createCodeBlock(config: CodeBlockConfig | undefined) {
	/** Line effects the site uses (core defaults + the site config's `codeBlock.lineEffects`). Editor menu order. */
	const CODE_LINE_EFFECTS = resolveLabels(resolveCodeLineEffects(config?.lineEffects));

	/** Code fence comment config the site uses. Used by the text formats' fence conversion and the public renderer (`fromCodeBlockDocumentToShikiAnnotationPayload`). */
	const annotationConfig = createAnnotationConfig(CODE_LINE_EFFECTS);

	/** A line effect definition. `undefined` for an unknown name. */
	const lineEffectDefinition = (name: string) => CODE_LINE_EFFECTS.find((effect) => effect.name === name);

	/** Whether this is a line effect name the editor knows (effects in the definition list plus line folding and the body-link label). */
	const isLineEffectName = (name: string): name is CodeLineEffectName =>
		name === COLLAPSE || name === ANCHOR || CODE_LINE_EFFECTS.some((effect) => effect.name === name);

	const omittedLineEffects = new Set(config?.omitLineEffects ?? []);

	/** Line effects the editor offers, in menu order (`CODE_LINE_EFFECTS` without the site's `codeBlock.omitLineEffects`). */
	const OFFERED_LINE_EFFECTS: readonly CodeLineEffectDefinition[] = CODE_LINE_EFFECTS.filter(
		(effect) => !omittedLineEffects.has(effect.name),
	);

	/** Code block tools the editor offers (the site's `codeBlock.features`; all on by default). Bodies that use a tool that is off still render. */
	const CODE_BLOCK_FEATURES: Required<CodeBlockFeatures> = {
		rules: true,
		fold: true,
		tooltip: true,
		textStyles: true,
		...config?.features,
	};

	/** Whether the editor offers a text effect (a `CODE_CHAR_EFFECTS` name: `strong`, `em`, `del`, `u`, `Tooltip`, `fold`). */
	const offersCharEffect = (name: string): boolean =>
		name === "fold"
			? CODE_BLOCK_FEATURES.fold
			: name === "Tooltip"
				? CODE_BLOCK_FEATURES.tooltip
				: CODE_BLOCK_FEATURES.textStyles;

	/** Highlighting themes of the site (Shiki theme names), for the public page and the editor. */
	const CODE_BLOCK_THEMES: CodeBlockThemes = config?.themes ?? DEFAULT_CODE_BLOCK_THEMES;

	/** Languages the site adds to the default list (`codeBlock.languages`). */
	const EXTRA_CODE_LANGUAGES: readonly string[] = config?.languages ?? [];

	return {
		CODE_LINE_EFFECTS,
		annotationConfig,
		lineEffectDefinition,
		isLineEffectName,
		OFFERED_LINE_EFFECTS,
		CODE_BLOCK_FEATURES,
		offersCharEffect,
		CODE_BLOCK_THEMES,
		EXTRA_CODE_LANGUAGES,
	};
}
