"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { AdminShell } from "../shared/admin-shell.js";
import { EventsScreen } from "./events-screen.js";
import { eventsMessages } from "./messages.js";
/** The event log page: the shared frame (sidebar, title) around the log. */
export function EventsPageScreen() {
    const t = useTranslator(eventsMessages);
    return (_jsx(AdminShell, { title: t("title"), sidebar: { activeNav: "events" }, children: _jsx(EventsScreen, {}) }));
}
