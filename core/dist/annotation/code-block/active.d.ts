import { type CodeBlockConfig, type CodeBlockFeatures, type CodeBlockThemes, type CodeLineEffectDefinition } from "./line-effects.js";
import { type CodeLineEffectName } from "./model.js";
/** The code block settings of one site. */
export type SiteCodeBlock = ReturnType<typeof createCodeBlock>;
/**
 * The code block rules of a site config's `codeBlock`: the line effects, the editor tools, the themes and the languages. The labels of the line effects
 * (getters in `line-effects.ts`) are read once, in the language the caller has set (`createSite` does it for the admin language).
 */
export declare function createCodeBlock(config: CodeBlockConfig | undefined): {
    CODE_LINE_EFFECTS: readonly CodeLineEffectDefinition[];
    annotationConfig: import("./types.js").AnnotationConfig;
    lineEffectDefinition: (name: string) => CodeLineEffectDefinition | undefined;
    isLineEffectName: (name: string) => name is CodeLineEffectName;
    OFFERED_LINE_EFFECTS: readonly CodeLineEffectDefinition[];
    CODE_BLOCK_FEATURES: Required<CodeBlockFeatures>;
    offersCharEffect: (name: string) => boolean;
    CODE_BLOCK_THEMES: CodeBlockThemes;
    EXTRA_CODE_LANGUAGES: readonly string[];
};
