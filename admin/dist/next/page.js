import { jsx as _jsx } from "react/jsx-runtime";
import { notFound } from "next/navigation";
import { loadAdminPlugins } from "../plugins.js";
import EditEntryPage from "../screens/entries/[id]/edit/page.js";
import NewEntryPage from "../screens/entries/new/page.js";
import LoginPage from "../screens/login/page.js";
import MediaPage from "../screens/media/page.js";
import DashboardPage from "../screens/page.js";
import { requireAdminPage } from "../screens/require-admin.js";
import TemplatesPage from "../screens/templates/page.js";
import TrashPage from "../screens/trash/page.js";
/**
 * A single admin screen. Rendered by the app's admin route (default `app/(admin)/admin/[[...path]]/page.tsx`). The path after the admin path
 * selects the screen. The admin path is the site config's `admin.path` (default `/admin`) and must match the route folder.
 *
 * - `/admin` list · `/admin/trash` trash · `/admin/media` media · `/admin/templates` body templates
 * - `/admin/entries/new` new entry · `/admin/entries/<id>/edit` edit · `/admin/login` login
 * - `/admin/<path>` plugin screens (e.g. the AI plugin's `/admin/ai`)
 */
export async function CmsAdminPage({ params, searchParams }) {
    const path = (await params).path ?? [];
    const [first, second, third, ...rest] = path;
    if (rest.length > 0)
        notFound();
    if (path.length === 0)
        return _jsx(DashboardPage, {});
    if (path.length === 1) {
        switch (first) {
            case "trash":
                return _jsx(TrashPage, {});
            case "media":
                return _jsx(MediaPage, {});
            case "templates":
                return _jsx(TemplatesPage, {});
            case "login":
                return _jsx(LoginPage, {});
        }
    }
    if (path.length === 1 && first) {
        const Page = (await loadAdminPlugins()).find((plugin) => plugin.pages?.[first])?.pages?.[first];
        if (Page) {
            await requireAdminPage();
            return _jsx(Page, {});
        }
    }
    if (first === "entries" && second === "new" && third === undefined) {
        const query = await searchParams;
        const one = (value) => (Array.isArray(value) ? value[0] : value);
        return (_jsx(NewEntryPage, { searchParams: Promise.resolve({ collection: one(query.collection), folder: one(query.folder) }) }));
    }
    if (first === "entries" && second && third === "edit") {
        return _jsx(EditEntryPage, { params: Promise.resolve({ id: second }) });
    }
    notFound();
}
