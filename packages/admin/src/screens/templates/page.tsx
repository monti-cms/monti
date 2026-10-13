import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { ShellPage } from "../shared/admin-shell";
import { templatesMessages } from "./messages";
import { TemplateManager } from "./template-manager";

/** `<admin path>/templates`: the body templates. A 404 when the site turns templates off (`admin.templates: false`). */
export default async function AdminTemplatesPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	const t = cms.site.createTranslator(templatesMessages);
	await requireAdminPage(cms, server);
	if (!cms.site.ADMIN_TEMPLATES) return server.notFound();
	return (
		<ShellPage title={t("title")} nav="templates">
			<TemplateManager />
		</ShellPage>
	);
}
