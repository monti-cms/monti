// Set the dictionary language first so labels (`label`) know the UI language.
import "../../i18n/index.js";
import { cmsConfig } from "../../config/resolved.js";
import { createAnnotationConfig } from "./constants.js";
import { resolveCodeLineEffects } from "./line-effects.js";
import { ANCHOR, COLLAPSE } from "./model.js";
/** Line effects the site uses (core defaults + the site config's `codeBlock.lineEffects`). Editor menu order. */
export const CODE_LINE_EFFECTS = resolveCodeLineEffects(cmsConfig.codeBlock?.lineEffects);
/** Code fence comment config the site uses. Used by storage syntax conversion and the public renderer (`remarkAnnotationToShikiDecoration`). */
export const annotationConfig = createAnnotationConfig(CODE_LINE_EFFECTS);
/** A line effect definition. `undefined` for an unknown name. */
export const lineEffectDefinition = (name) => CODE_LINE_EFFECTS.find((effect) => effect.name === name);
/** Whether this is a line effect name the editor knows (effects in the definition list plus line folding and the body-link label). */
export const isLineEffectName = (name) => name === COLLAPSE || name === ANCHOR || CODE_LINE_EFFECTS.some((effect) => effect.name === name);
