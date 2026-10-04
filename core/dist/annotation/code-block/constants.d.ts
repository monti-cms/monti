import { type CodeLineEffectDefinition } from "./line-effects.js";
import type { AnnotationConfig } from "./types.js";
/**
 * Code fence comment config. Order: text effects, line effects (definition list), line folding, body-link label.
 * The config the site uses is `annotationConfig` in `active.ts`.
 */
export declare function createAnnotationConfig(lineEffects?: readonly CodeLineEffectDefinition[]): AnnotationConfig;
