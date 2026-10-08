import { jsx as _jsx } from "react/jsx-runtime";
import { AdminClientDashboard } from "./admin-dashboard.js";
import { requireAdminPage } from "./require-admin.js";
export default async function AdminPage({ cms, server }) {
    await requireAdminPage(cms, server);
    return _jsx(AdminClientDashboard, {});
}
