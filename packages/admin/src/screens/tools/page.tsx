import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { loadAdminPlugins } from "../../plugins";
import { requireAdminPage } from "../require-admin";
import { ShellPage } from "../shared/admin-shell";
import { toolsPages } from "./tools-pages";

/**
 * `<admin path>/tools/<path>`: the page of a plugin `nav` item, drawn by the plugin's `pages` entry and framed by the admin (sidebar, title).
 * An unknown path is a 404.
 */
export default async function AdminToolsPage({ cms, server, path }: { cms: Cms; server: AdminServer; path: string }) {
	await requireAdminPage(cms, server);
	const entry = toolsPages(cms.site).find((page) => page.path === path);
	const Page = (await loadAdminPlugins(cms.site)).find((plugin) => plugin.pages?.[path])?.pages?.[path];
	if (!entry || !Page) return server.notFound();
	return (
		<ShellPage title={entry.label} nav={`tools:${path}`}>
			<Page />
		</ShellPage>
	);
}
