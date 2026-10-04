import type { Root } from "hast";
import { type CodeHighlighterOptions, type HighlightFn } from "./code-highlighter.js";
export type RehypeShikiDecorationRenderOptions = CodeHighlighterOptions & {
    ignoreLang?: (lang: string) => boolean;
    /** Function that highlights code. If given, `langs`, `themes` and `langAlias` are not used. */
    highlight?: HighlightFn;
};
/** Code highlighting settings (languages, themes, aliases). Reference defaults if not given. */
export type CodeHighlightOptions = RehypeShikiDecorationRenderOptions;
export declare function rehypeShikiDecorationRender(options?: RehypeShikiDecorationRenderOptions): (tree: Root) => Promise<void>;
