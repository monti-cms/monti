import "../../i18n/index.js";
import { type CodeLineEffectName } from "./model.js";
/** Line effects the site uses (core defaults + the site config's `codeBlock.lineEffects`). Editor menu order. */
export declare const CODE_LINE_EFFECTS: readonly import("./line-effects.js").CodeLineEffectDefinition[];
/** Code fence comment config the site uses. Used by storage syntax conversion and the public renderer (`remarkAnnotationToShikiDecoration`). */
export declare const annotationConfig: import("./types.js").AnnotationConfig;
/** A line effect definition. `undefined` for an unknown name. */
export declare const lineEffectDefinition: (name: string) => import("./line-effects.js").CodeLineEffectDefinition | undefined;
/** Whether this is a line effect name the editor knows (effects in the definition list plus line folding and the body-link label). */
export declare const isLineEffectName: (name: string) => name is CodeLineEffectName;
