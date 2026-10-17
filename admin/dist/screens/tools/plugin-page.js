"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { EmptyState } from "../shared/empty-state.js";
import { toolsMessages } from "./messages.js";
/** Draws a plugin's page for a `nav` path. The declaration is read here, in the browser: the server may only refer to a `"use client"` admin module. */
export function PluginToolPage({ plugin, name, path, }) {
    const t = useTranslator(toolsMessages);
    const Page = plugin?.pages?.[path];
    if (Page)
        return _jsx(Page, {});
    return _jsx(EmptyState, { title: t("missingTitle"), description: t("missingBody", { plugin: name, path }) });
}
