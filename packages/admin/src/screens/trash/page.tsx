import type { Cms } from "@monti-cms/core/runtime";
import { AdminTrashDashboard } from "../admin-dashboard";
import { requireAdminPage } from "../require-admin";

export default async function AdminTrashPage({ cms }: { cms: Cms }) {
	await requireAdminPage(cms);
	return <AdminTrashDashboard />;
}
