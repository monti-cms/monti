import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { loadAdminPlugins } from "../../internal-plugins";
import { requireAdminPage } from "../require-admin";
import { PluginScreenView } from "./plugin-screen";

/**
 * `<admin path>/<plugin name>/<screen>/<param>`: a screen of its own that a plugin adds (`defineAdminPlugin({ screens })`), framed by the admin like any
 * page. The AI plugin's proposal review is `/admin/ai/review/<id>`. A name or screen the plugins do not have is a 404. The core's own addresses come first,
 * so a plugin named like one of them (`media`, `tools`) cannot take it.
 */
export default async function PluginScreenPage({
	cms,
	server,
	plugin: name,
	screen,
	params,
}: {
	cms: Cms;
	server: AdminServer;
	plugin: string;
	screen: string;
	params: readonly string[];
}) {
	await requireAdminPage(cms, server);
	const owner = (await loadAdminPlugins(cms.site)).find((candidate) => candidate.name === name);
	if (!owner?.plugin?.screens?.[screen]) return server.notFound();
	return <PluginScreenView plugin={owner.plugin} screen={screen} params={params} />;
}
