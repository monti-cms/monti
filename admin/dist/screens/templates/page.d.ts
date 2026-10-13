import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server.js";
/** `<admin path>/templates`: the body templates. A 404 when the site turns templates off (`admin.templates: false`). */
export default function AdminTemplatesPage({ cms, server }: {
    cms: Cms;
    server: AdminServer;
}): Promise<import("react").JSX.Element>;
