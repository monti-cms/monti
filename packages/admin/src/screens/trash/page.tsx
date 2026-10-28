import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { TrashScreen } from "./trash-screen";

export default async function AdminTrashPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	return <TrashScreen />;
}
