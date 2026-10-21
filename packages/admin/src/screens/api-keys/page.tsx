import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { AdminShell } from "../shared/admin-shell";
import { ApiKeysSettings } from "./api-keys-settings";
import { apiKeysMessages } from "./messages";

/** `<admin path>/api-keys`: the central key store. */
export default async function AdminApiKeysPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	const t = cms.site.createTranslator(apiKeysMessages);
	await requireAdminPage(cms, server);
	return (
		<AdminShell title={t("title")} large description={t("description")} sidebar={{ activeNav: "api-keys" }}>
			<ApiKeysSettings />
		</AdminShell>
	);
}
