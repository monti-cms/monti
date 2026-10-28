"use client";

import type { AdminComponents } from "@monti-cms/admin";
import { Spark } from "@monti-cms/admin/kit";
import { useAiTranslateExtension } from "./ai-translate";
import { useAiWriteExtension } from "./ai-write";

/** The AI editor extensions (translate, write) and the AI icon. */
export const aiComponents: AdminComponents = {
	editorExtensions: [useAiTranslateExtension, useAiWriteExtension],
	// Icons picked by name by sidebar items (`nav`) and slash menu items.
	icons: { spark: Spark },
};
