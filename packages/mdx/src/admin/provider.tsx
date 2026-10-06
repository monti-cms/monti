"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import type { ReactNode } from "react";
import { configuredSyntax } from "../syntax-config";
import { createMdxBrowserFormat } from "./format";
import { MDX_SOURCE_LABEL, MdxSourcePanel } from "./source-panel";

/** What the MDX package registers in the admin: the `mdx` format (with the syntax extensions of `mdx({ syntax })`) and its source panel. */
let registered: CmsAdminComponents | undefined;
const components = (): CmsAdminComponents => {
	if (registered) return registered;
	const format = createMdxBrowserFormat({ syntax: configuredSyntax() });
	registered = {
		formats: { [format.name]: format },
		sourcePanels: [{ format: format.name, label: MDX_SOURCE_LABEL, Panel: MdxSourcePanel }],
	};
	return registered;
};

/**
 * Registers the MDX format and its source panel in the admin (`useCmsAdminComponents().sourcePanels`, `useFormat("mdx")`). The admin renders it for the
 * `mdx()` plugin; without the plugin there is no source toggle and no `mdx` format in the browser.
 */
export function MdxAdminProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components()}>{children}</CmsAdminComponentsProvider>;
}
