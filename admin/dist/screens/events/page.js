import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { EventsScreen } from "./events-screen.js";
export default async function AdminEventsPage({ cms, server }) {
    await requireAdminPage(cms, server);
    return _jsx(EventsScreen, {});
}
