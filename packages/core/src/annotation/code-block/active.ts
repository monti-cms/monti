// Set the dictionary language first so labels (`label`) know the UI language.
import "../../i18n";
import { cmsConfig } from "../../config/resolved";
import { createAnnotationConfig } from "./constants";
import { resolveCodeLineEffects } from "./line-effects";
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
