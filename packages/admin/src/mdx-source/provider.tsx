"use client";

import type { ReactNode } from "react";
import { type CmsAdminComponents, CmsAdminComponentsProvider } from "../admin-components";
import { mdxBrowserFormat } from "./format";
import { MDX_SOURCE_LABEL, MdxSourcePanel } from "./source-panel";

/** What the MDX module registers in the admin: the `mdx` format and its source panel. */
const MDX_SOURCE_COMPONENTS: CmsAdminComponents = {
	formats: { [mdxBrowserFormat.name]: mdxBrowserFormat },
	sourcePanels: [{ format: mdxBrowserFormat.name, label: MDX_SOURCE_LABEL, Panel: MdxSourcePanel }],
};

/**
 * Registers the MDX format and its source panel in the admin (`useCmsAdminComponents().sourcePanels`, `useFormat("mdx")`). The admin layout renders it for the
 * built-in format; the `@monti-cms/mdx` plugin does the same from its own admin provider once MDX is a package of its own.
 */
export function MdxSourceProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={MDX_SOURCE_COMPONENTS}>{children}</CmsAdminComponentsProvider>;
}
