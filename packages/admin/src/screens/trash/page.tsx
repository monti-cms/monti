import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { AdminTrashDashboard } from "../admin-dashboard";
import { requireAdminPage } from "../require-admin";

export default async function AdminTrashPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	return <AdminTrashDashboard />;
}
