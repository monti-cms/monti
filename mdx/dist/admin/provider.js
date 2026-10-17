"use client";
import { configuredSyntax } from "../syntax-config.js";
import { createMdxBrowserFormat } from "./format.js";
import { MdxSourcePanel, mdxSourceLabel } from "./source-panel.js";
/** What the MDX package registers in the admin of a site: the `mdx` format (with the syntax extensions of `mdx({ syntax })`) and its source panel. */
export const mdxComponents = (site) => {
    const format = createMdxBrowserFormat(site, { syntax: configuredSyntax(site) });
    return {
        formats: { [format.name]: format },
        sourcePanels: [{ format: format.name, label: mdxSourceLabel(site), Panel: MdxSourcePanel }],
    };
};
