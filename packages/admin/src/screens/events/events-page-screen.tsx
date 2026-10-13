"use client";

import { useTranslator } from "@monti-cms/core/client";
import { AdminShell } from "../shared/admin-shell";
import { EventsScreen } from "./events-screen";
import { eventsMessages } from "./messages";

/** The event log page: the shared frame (sidebar, title) around the log. */
export function EventsPageScreen() {
	const t = useTranslator(eventsMessages);
	return (
		<AdminShell title={t("title")} sidebar={{ activeNav: "events" }}>
			<EventsScreen />
		</AdminShell>
	);
}
