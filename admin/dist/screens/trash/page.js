import { jsx as _jsx } from "react/jsx-runtime";
import { AdminTrashDashboard } from "../admin-dashboard.js";
import { requireAdminPage } from "../require-admin.js";
export default async function AdminTrashPage({ cms, server }) {
    await requireAdminPage(cms, server);
    return _jsx(AdminTrashDashboard, {});
}
