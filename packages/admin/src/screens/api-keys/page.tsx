import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { ApiKeysPageScreen } from "./api-keys-page-screen";

/** `<admin path>/api-keys`: the central key store. */
export default async function AdminApiKeysPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	return <ApiKeysPageScreen />;
}
