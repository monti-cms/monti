import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server.js";
/** `<admin path>/data`: the site backup, the entry import and the backup restore. */
export default function AdminDataPage({ cms, server }: {
    cms: Cms;
    server: AdminServer;
}): Promise<import("react").JSX.Element>;
