import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { TemplateManager } from "./template-manager.js";
export default async function AdminTemplatesPage({ cms, server }) {
    // The site turned templates off (`admin.templates: false`): the screen does not exist.
    if (!cms.site.ADMIN_TEMPLATES)
        server.notFound();
    await requireAdminPage(cms, server);
    return _jsx(TemplateManager, {});
}
