import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { DataScreen } from "./data-screen";

/** `<admin path>/data`: the site backup, the entry import and the backup restore. */
export default async function AdminDataPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	return <DataScreen />;
}
