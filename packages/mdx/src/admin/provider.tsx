"use client";

import { type AdminComponents, AdminComponentsProvider } from "@monti-cms/admin";
import { type Site, useSite } from "@monti-cms/core/site";
import { type ReactNode, useMemo } from "react";
import { configuredSyntax } from "../syntax-config";
import { createMdxBrowserFormat } from "./format";
import { MdxSourcePanel, mdxSourceLabel } from "./source-panel";

/** What the MDX package registers in the admin of a site: the `mdx` format (with the syntax extensions of `mdx({ syntax })`) and its source panel. */
const componentsOf = (site: Site): AdminComponents => {
	const format = createMdxBrowserFormat(site, { syntax: configuredSyntax(site) });
	return {
		formats: { [format.name]: format },
		sourcePanels: [{ format: format.name, label: mdxSourceLabel(site), Panel: MdxSourcePanel }],
	};
};

/**
 * Registers the MDX format and its source panel in the admin (`useAdminComponents().sourcePanels`, `useFormat("mdx")`). The admin renders it for the
 * `mdx()` plugin; without the plugin there is no source toggle and no `mdx` format in the browser.
 */
export function MdxAdminProvider({ children }: { children: ReactNode }) {
	const site = useSite();
	const components = useMemo(() => componentsOf(site), [site]);
	return <AdminComponentsProvider components={components}>{children}</AdminComponentsProvider>;
}
