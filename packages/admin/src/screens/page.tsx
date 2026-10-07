import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../host/server";
import { AdminClientDashboard } from "./admin-dashboard";
import { requireAdminPage } from "./require-admin";

export default async function AdminPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	return <AdminClientDashboard />;
}
