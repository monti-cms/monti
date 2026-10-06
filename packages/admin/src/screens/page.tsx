import type { Cms } from "@monti-cms/core/runtime";
import { AdminClientDashboard } from "./admin-dashboard";
import { requireAdminPage } from "./require-admin";

export default async function AdminPage({ cms }: { cms: Cms }) {
	await requireAdminPage(cms);
	return <AdminClientDashboard />;
}
