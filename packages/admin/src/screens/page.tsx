import { AdminClientDashboard } from "./admin-dashboard";
import { requireAdminPage } from "./require-admin";

export default async function AdminPage() {
	await requireAdminPage();
	return <AdminClientDashboard />;
}
