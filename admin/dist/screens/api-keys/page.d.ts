import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../../host/server.js";
/** `<admin path>/api-keys`: the central key store. */
export default function AdminApiKeysPage({ cms, server }: {
    cms: Cms;
    server: AdminServer;
}): Promise<import("react").JSX.Element>;
