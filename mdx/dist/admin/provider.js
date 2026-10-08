"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { useSite } from "@monti-cms/core/client";
import { useMemo } from "react";
import { configuredSyntax } from "../syntax-config.js";
import { createMdxBrowserFormat } from "./format.js";
import { MdxSourcePanel, mdxSourceLabel } from "./source-panel.js";
/** What the MDX package registers in the admin of a site: the `mdx` format (with the syntax extensions of `mdx({ syntax })`) and its source panel. */
const componentsOf = (site) => {
    const format = createMdxBrowserFormat(site, { syntax: configuredSyntax(site) });
    return {
        formats: { [format.name]: format },
        sourcePanels: [{ format: format.name, label: mdxSourceLabel(site), Panel: MdxSourcePanel }],
    };
};
/**
 * Registers the MDX format and its source panel in the admin (`useCmsAdminComponents().sourcePanels`, `useFormat("mdx")`). The admin renders it for the
 * `mdx()` plugin; without the plugin there is no source toggle and no `mdx` format in the browser.
 */
export function MdxAdminProvider({ children }) {
    const site = useSite();
    const components = useMemo(() => componentsOf(site), [site]);
    return _jsx(CmsAdminComponentsProvider, { components: components, children: children });
}
