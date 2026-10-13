"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { AdminShell } from "../shared/admin-shell.js";
import { templatesMessages } from "./messages.js";
import { TemplateManager } from "./template-manager.js";
/** The body templates page: the shared frame (sidebar, title) around the template manager. */
export function TemplatesScreen() {
    const t = useTranslator(templatesMessages);
    return (_jsx(AdminShell, { title: t("title"), sidebar: { activeNav: "templates" }, children: _jsx(TemplateManager, {}) }));
}
