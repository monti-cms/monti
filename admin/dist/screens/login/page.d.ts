import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server.js";
/**
 * Sign in and out are plain form posts to the core API (its `v1/session/*` routes), not server actions: a server action cannot carry the
 * CMS instance, because the values it closes over must be serializable.
 */
export default function AdminLoginPage({ cms, server }: {
    cms: Cms;
    server: AdminServer;
}): Promise<import("react").JSX.Element>;
