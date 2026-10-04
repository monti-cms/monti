import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { TemplateManager } from "./template-manager.js";
export default async function AdminTemplatesPage() {
    await requireAdminPage();
    return _jsx(TemplateManager, {});
}
