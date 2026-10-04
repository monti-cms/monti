import { AdminTrashDashboard } from "../admin-dashboard";
import { requireAdminPage } from "../require-admin";

export default async function AdminTrashPage() {
	await requireAdminPage();
	return <AdminTrashDashboard />;
}
