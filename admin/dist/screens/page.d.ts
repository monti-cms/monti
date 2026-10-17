import type { Cms } from "@monti-cms/core/server";
import type { AdminServer } from "../host/server.js";
export default function AdminPage({ cms, server }: {
    cms: Cms;
    server: AdminServer;
}): Promise<import("react").JSX.Element>;
