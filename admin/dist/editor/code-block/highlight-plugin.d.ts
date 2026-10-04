import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Highlighter } from "shiki";
export declare const codeBlockHighlightPluginKey: PluginKey<{
    version: number;
}>;
export declare function getShikiHighlighter(): Promise<Highlighter>;
export declare function createCodeBlockHighlightPlugin(): Plugin;
