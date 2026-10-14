import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { ShellPage } from "../shared/admin-shell.js";
import { templatesMessages } from "./messages.js";
import { TemplateManager } from "./template-manager.js";
/** `<admin path>/templates`: the body templates. A 404 when the site turns templates off (`admin.templates: false`). */
export default async function AdminTemplatesPage({ cms, server }) {
    const t = cms.site.createTranslator(templatesMessages);
    await requireAdminPage(cms, server);
    if (!cms.site.ADMIN_TEMPLATES)
        return server.notFound();
    return (_jsx(ShellPage, { title: t("title"), nav: "templates", children: _jsx(TemplateManager, {}) }));
}
