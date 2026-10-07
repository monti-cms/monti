import type { Cms } from "@monti-cms/core/runtime";
import { loadAdminPlugins } from "../plugins";
import EditEntryPage from "../screens/entries/[id]/edit/page";
import NewEntryPage from "../screens/entries/new/page";
import EventsPage from "../screens/events/page";
import LoginPage from "../screens/login/page";
import MediaPage from "../screens/media/page";
import DashboardPage from "../screens/page";
import { requireAdminPage } from "../screens/require-admin";
import SchemaPage from "../screens/schema/page";
import TemplatesPage from "../screens/templates/page";
import TrashPage from "../screens/trash/page";
import type { AdminServer } from "./server";

export interface AdminPageProps {
	params: Promise<{ path?: string[] }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
	/** The CMS instance: the `cms` exported by the app's server file. */
	cms: Cms;
	/** What the framework does for a redirect and a 404 (see `AdminServer`). */
	server: AdminServer;
}

/**
 * A single admin screen, framework-neutral. A host package renders it from the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen. The admin path is the site config's `admin.path` (default `/admin`) and must match the route folder.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates · `/admin/events` failed event deliveries · `/admin/schema` schema settings
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 * - `/admin/<path>` plugin screens (e.g. the AI plugin's `/admin/ai`)
 */
export async function AdminPage({ cms, server, params, searchParams }: AdminPageProps) {
	const path = (await params).path ?? [];
	const [first, second, third, ...rest] = path;
	if (rest.length > 0) server.notFound();
	if (path.length === 0) return <DashboardPage cms={cms} server={server} />;
	if (path.length === 1) {
		switch (first) {
			case "trash":
				return <TrashPage cms={cms} server={server} />;
			case "media":
				return <MediaPage cms={cms} server={server} />;
			case "templates":
				return <TemplatesPage cms={cms} server={server} />;
			case "events":
				return <EventsPage cms={cms} server={server} />;
			case "schema":
				return <SchemaPage cms={cms} server={server} />;
			case "login":
				return <LoginPage cms={cms} server={server} />;
		}
	}
	if (path.length === 1 && first) {
		const Page = (await loadAdminPlugins(cms.site)).find((plugin) => plugin.pages?.[first])?.pages?.[first];
		if (Page) {
			await requireAdminPage(cms, server);
			return <Page />;
		}
	}
	if (first === "entries" && second === "new" && third === undefined) {
		const query = await searchParams;
		const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
		return (
			<NewEntryPage
				cms={cms}
				server={server}
				searchParams={Promise.resolve({ collection: one(query.collection), folder: one(query.folder) })}
			/>
		);
	}
	if (first === "entries" && second && third === "edit") {
		return <EditEntryPage cms={cms} server={server} params={Promise.resolve({ id: second })} />;
	}
	server.notFound();
}
