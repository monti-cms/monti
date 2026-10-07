import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server";
import { requireAdminPage } from "../require-admin";
import { EventsScreen } from "./events-screen";

export default async function AdminEventsPage({ cms, server }: { cms: Cms; server: AdminServer }) {
	await requireAdminPage(cms, server);
	return <EventsScreen />;
}
