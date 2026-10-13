import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server.js";
/** `<admin path>/events`: the event log. */
export default function AdminEventsPage({ cms, server }: {
    cms: Cms;
    server: AdminServer;
}): Promise<import("react").JSX.Element>;
