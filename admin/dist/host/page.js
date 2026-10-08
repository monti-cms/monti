import { jsx as _jsx } from "react/jsx-runtime";
import { loadAdminPlugins } from "../plugins.js";
import EditEntryPage from "../screens/entries/[id]/edit/page.js";
import NewEntryPage from "../screens/entries/new/page.js";
import EventsPage from "../screens/events/page.js";
import LoginPage from "../screens/login/page.js";
import MediaPage from "../screens/media/page.js";
import DashboardPage from "../screens/page.js";
import { requireAdminPage } from "../screens/require-admin.js";
import SchemaPage from "../screens/schema/page.js";
import TemplatesPage from "../screens/templates/page.js";
import TrashPage from "../screens/trash/page.js";
/**
 * A single admin screen, framework-neutral. A host package renders it from the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen. The admin path is the site config's `admin.path` (default `/admin`) and must match the route folder.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates · `/admin/events` failed event deliveries · `/admin/schema` schema settings
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 * - `/admin/<path>` plugin screens (e.g. the AI plugin's `/admin/ai`)
 */
export async function AdminPage({ cms, server, params, searchParams }) {
    const path = (await params).path ?? [];
    const [first, second, third, ...rest] = path;
    if (rest.length > 0)
        server.notFound();
    if (path.length === 0)
        return _jsx(DashboardPage, { cms: cms, server: server });
    if (path.length === 1) {
        switch (first) {
            case "trash":
                return _jsx(TrashPage, { cms: cms, server: server });
            case "media":
                return _jsx(MediaPage, { cms: cms, server: server });
            case "templates":
                return _jsx(TemplatesPage, { cms: cms, server: server });
            case "events":
                return _jsx(EventsPage, { cms: cms, server: server });
            case "schema":
                return _jsx(SchemaPage, { cms: cms, server: server });
            case "login":
                return _jsx(LoginPage, { cms: cms, server: server });
        }
    }
    if (path.length === 1 && first) {
        const Page = (await loadAdminPlugins(cms.site)).find((plugin) => plugin.pages?.[first])?.pages?.[first];
        if (Page) {
            await requireAdminPage(cms, server);
            return _jsx(Page, {});
        }
    }
    if (first === "entries" && second === "new" && third === undefined) {
        const query = await searchParams;
        const one = (value) => (Array.isArray(value) ? value[0] : value);
        return (_jsx(NewEntryPage, { cms: cms, server: server, searchParams: Promise.resolve({ collection: one(query.collection), folder: one(query.folder) }) }));
    }
    if (first === "entries" && second && third === "edit") {
        return _jsx(EditEntryPage, { cms: cms, server: server, params: Promise.resolve({ id: second }) });
    }
    server.notFound();
}
