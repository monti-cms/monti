import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { EventsPageScreen } from "./events-page-screen.js";
/** `<admin path>/events`: the event log. */
export default async function AdminEventsPage({ cms, server }) {
    await requireAdminPage(cms, server);
    return _jsx(EventsPageScreen, {});
}
