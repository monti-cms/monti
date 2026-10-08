import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../../../host/server.js";
interface PageProps {
    cms: Cms;
    server: AdminServer;
    params: Promise<{
        id: string;
    }>;
}
export default function EditEntryPage({ cms, server, params }: PageProps): Promise<import("react").JSX.Element>;
export {};
