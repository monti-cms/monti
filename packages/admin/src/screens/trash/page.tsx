import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { TrashScreen } from "../entry-list-screen";
import { requireAdminPage } from "../require-admin";

export default async function AdminTrashPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	return <TrashScreen />;
}
