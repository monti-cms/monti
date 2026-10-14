import { jsx as _jsx } from "react/jsx-runtime";
import { requireAdminPage } from "../require-admin.js";
import { ShellPage } from "../shared/admin-shell.js";
import { EventsScreen } from "./events-screen.js";
import { eventsMessages } from "./messages.js";
/** `<admin path>/events`: the event log. */
export default async function AdminEventsPage({ cms, server }) {
    const t = cms.site.createTranslator(eventsMessages);
    await requireAdminPage(cms, server);
    return (_jsx(ShellPage, { title: t("title"), nav: "events", children: _jsx(EventsScreen, {}) }));
}
