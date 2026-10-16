import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { ShellPage } from "../shared/admin-shell";
import { EventsScreen } from "./events-screen";
import { eventsMessages } from "./messages";

/** `<admin path>/events`: the event log. */
export default async function AdminEventsPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	const t = cms.site.createTranslator(eventsMessages);
	await requireAdminPage(cms, server);
	return (
		<ShellPage title={t("title")} nav="events">
			<EventsScreen />
		</ShellPage>
	);
}
