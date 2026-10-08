import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../host/server.js";
export default function AdminSchemaPage({ cms, server }: {
    cms: Cms;
    server: AdminServer;
}): Promise<import("react").JSX.Element>;
