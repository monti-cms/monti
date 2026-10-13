import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { TemplatesScreen } from "./templates-screen.js";
/** `<admin path>/templates`: the body templates. A 404 when the site turns templates off (`admin.templates: false`). */
export default async function AdminTemplatesPage({ cms, server }) {
    await requireAdminPage(cms, server);
    if (!cms.site.ADMIN_TEMPLATES)
        return server.notFound();
    return _jsx(TemplatesScreen, {});
}
