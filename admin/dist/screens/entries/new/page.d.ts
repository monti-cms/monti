import type { Cms } from "@monti-cms/core/runtime";
import type { AdminServer } from "../../../host/server.js";
interface PageProps {
    cms: Cms;
    server: AdminServer;
    searchParams: Promise<{
        collection?: string;
        folder?: string;
    }>;
}
export default function NewEntryPage({ cms, server, searchParams }: PageProps): Promise<import("react").JSX.Element>;
export {};
