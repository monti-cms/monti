"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { attachCodeTools, type CodeToolsLabels } from "./code-tools";

/**
 * Put once in the site's layout: the code blocks `renderDocument` draws get their copy button, folded words and code links (doc 17). It draws
 * nothing. `labels` are its words in the site's language.
 */
export function CodeTools({ labels }: { labels?: CodeToolsLabels }) {
	// A new page is new code blocks.
	const path = usePathname();
	const back = labels?.back;
	useEffect(() => {
		void path;
		return attachCodeTools(document, back ? { back } : undefined);
	}, [path, back]);
	return null;
}
