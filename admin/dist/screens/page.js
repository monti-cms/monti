import { jsx as _jsx } from "react/jsx-runtime";
import { AdminClientDashboard } from "./admin-dashboard.js";
import { requireAdminPage } from "./require-admin.js";
export default async function AdminPage() {
    await requireAdminPage();
    return _jsx(AdminClientDashboard, {});
}
