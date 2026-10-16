"use client";

import { type AdminComponents, AdminComponentsProvider } from "@monti-cms/admin";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { AiSlotProvider } from "./ai-slot-provider";
import { useAiTranslateExtension } from "./ai-translate";
import { useAiWriteExtension } from "./ai-write";

const components: AdminComponents = {
	editorExtensions: [useAiTranslateExtension, useAiWriteExtension],
	// Icons picked by name by sidebar items (`nav`) and slash menu items.
	icons: { sparkles: Sparkles },
};

/** What the AI plugin adds to the whole admin screen: AI buttons at slots (next to fields, etc.), AI translation in the translation editor, polish and draft writing in the body. */
export function AiAdminProvider({ children }: { children: ReactNode }) {
	return (
		<AiSlotProvider>
			<AdminComponentsProvider components={components}>{children}</AdminComponentsProvider>
		</AiSlotProvider>
	);
}
