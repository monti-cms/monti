"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { Sparkles } from "lucide-react";
import { AiSlotProvider } from "./ai-slot-provider.js";
import { useAiTranslateExtension } from "./ai-translate.js";
import { useAiWriteExtension } from "./ai-write.js";
const components = {
    editorExtensions: [useAiTranslateExtension, useAiWriteExtension],
    // Icons picked by name by sidebar items (`nav`) and slash menu items.
    icons: { sparkles: Sparkles },
};
/** What the AI plugin adds to the whole admin screen: AI buttons at slots (next to fields, etc.), AI translation in the translation editor, polish and draft writing in the body. */
export function AiAdminProvider({ children }) {
    return (_jsx(AiSlotProvider, { children: _jsx(CmsAdminComponentsProvider, { components: components, children: children }) }));
}
