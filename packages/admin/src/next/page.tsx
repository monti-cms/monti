import { notFound } from "next/navigation";
import { loadAdminPlugins } from "../plugins";
import EditEntryPage from "../screens/entries/[id]/edit/page";
import NewEntryPage from "../screens/entries/new/page";
import LoginPage from "../screens/login/page";
import MediaPage from "../screens/media/page";
import DashboardPage from "../screens/page";
import { requireAdminPage } from "../screens/require-admin";
import TemplatesPage from "../screens/templates/page";
import TrashPage from "../screens/trash/page";

export interface CmsAdminPageProps {
	params: Promise<{ path?: string[] }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * A single admin screen. Rendered by the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen. The admin path is the site config's `admin.path` (default `/admin`) and must match the route folder.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 * - `/admin/<path>` plugin screens (e.g. the AI plugin's `/admin/ai`)
 */
export async function CmsAdminPage({ params, searchParams }: CmsAdminPageProps) {
	const path = (await params).path ?? [];
	const [first, second, third, ...rest] = path;
	if (rest.length > 0) notFound();
	if (path.length === 0) return <DashboardPage />;
	if (path.length === 1) {
		switch (first) {
			case "trash":
				return <TrashPage />;
			case "media":
				return <MediaPage />;
			case "templates":
				return <TemplatesPage />;
			case "login":
				return <LoginPage />;
		}
	}
	if (path.length === 1 && first) {
		const Page = (await loadAdminPlugins()).find((plugin) => plugin.pages?.[first])?.pages?.[first];
		if (Page) {
			await requireAdminPage();
			return <Page />;
		}
	}
	if (first === "entries" && second === "new" && third === undefined) {
		const query = await searchParams;
		const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
		return (
			<NewEntryPage searchParams={Promise.resolve({ collection: one(query.collection), folder: one(query.folder) })} />
		);
	}
	if (first === "entries" && second && third === "edit") {
		return <EditEntryPage params={Promise.resolve({ id: second })} />;
	}
	notFound();
}
