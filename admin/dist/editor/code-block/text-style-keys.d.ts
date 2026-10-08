import { type Site } from "@monti-cms/core/client";
import { Extension } from "@tiptap/core";
/**
 * Keeps Mod-B, Mod-I, Mod-U and Mod-Shift-S from adding bold, italic, underline and strikethrough inside code when `codeBlock.features.textStyles` is off.
 * Runs before the text style extensions (higher priority) and swallows only the shortcut that would add the style. Outside code nothing changes.
 */
export declare const codeTextStyleKeys: (site: Pick<Site, "CODE_BLOCK_FEATURES">) => Extension<any, any>;
