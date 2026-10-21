import { jsx as _jsx } from "react/jsx-runtime";
import ApiKeysPage from "../screens/api-keys/page.js";
import DataPage from "../screens/data/page.js";
import EditEntryPage from "../screens/entries/[id]/edit/page.js";
import NewEntryPage from "../screens/entries/new/page.js";
import EventsPage from "../screens/events/page.js";
import LoginPage from "../screens/login/page.js";
import MediaPage from "../screens/media/page.js";
import DashboardPage from "../screens/page.js";
import SettingsPage from "../screens/settings/page.js";
import TemplatesPage from "../screens/templates/page.js";
import ToolsPage from "../screens/tools/page.js";
import TrashPage from "../screens/trash/page.js";
/**
 * A single admin screen, framework-neutral. A host package renders it from the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen. The admin path is the site config's `admin.path` (default `/admin`) and must match the route folder.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates · `/admin/data` backup, import and restore · `/admin/events` event log ·
 *   `/admin/api-keys` API keys
 * - `/admin/settings/<tab>` Settings: `site`, `locales`, `collections`, `admin` (the schema file)
 * - `/admin/tools/<path>` Tools: one page per plugin `nav` item (e.g. the AI plugin's `/admin/tools/ai`)
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
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
            case "api-keys":
                return _jsx(ApiKeysPage, { cms: cms, server: server });
            case "data":
                return _jsx(DataPage, { cms: cms, server: server });
            case "settings":
                return _jsx(SettingsPage, { cms: cms, server: server, tab: undefined });
            case "login":
                return _jsx(LoginPage, { cms: cms, server: server, searchParams: searchParams });
        }
    }
    if (first === "settings" && second && path.length === 2) {
        return _jsx(SettingsPage, { cms: cms, server: server, tab: second });
    }
    if (first === "tools" && second && path.length === 2) {
        return _jsx(ToolsPage, { cms: cms, server: server, path: second });
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
