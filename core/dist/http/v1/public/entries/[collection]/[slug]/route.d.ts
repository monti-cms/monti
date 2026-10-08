import type { Cms } from "../../../../../../cms/index.js";
export declare const GET: (request: Request, context: {
    params?: Promise<{
        collection: string;
        slug: string;
    }>;
    cms: Cms;
}) => Promise<Response>;
