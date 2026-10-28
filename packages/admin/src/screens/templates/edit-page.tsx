import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { TemplateEditorScreen } from "./template-editor-screen";

/**
 * `<admin path>/templates/new` and `<admin path>/templates/<id>/edit`: the page of one template, outside the tools page. A 404 when the site turns
 * templates off.
 */
export default async function TemplateEditPage({
	cms,
	server,
	id,
}: {
	cms: Cms;
	server: AdminServer;
	id: string | undefined;
}) {
	await requireAdminPage(cms, server);
	if (!cms.site.ADMIN_TEMPLATES) return server.notFound();
	// Start over when another template opens.
	return <TemplateEditorScreen key={id ?? "new"} id={id} />;
}
