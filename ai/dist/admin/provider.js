"use client";
import { Sparkles } from "lucide-react";
import { useAiTranslateExtension } from "./ai-translate.js";
import { useAiWriteExtension } from "./ai-write.js";
/** The AI editor extensions (translate, write) and the AI icon. */
export const aiComponents = {
    editorExtensions: [useAiTranslateExtension, useAiWriteExtension],
    // Icons picked by name by sidebar items (`nav`) and slash menu items.
    icons: { sparkles: Sparkles },
};
