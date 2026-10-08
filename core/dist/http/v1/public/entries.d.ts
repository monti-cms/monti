import type { Cms } from "../../../cms/index.js";
/** `GET /api/cms/v1/public/entries?collection&page&pageSize&locale&<filters>` — published list (newest publish date first). */
export declare function GET(request: Request, { cms }: {
    cms: Cms;
}): Promise<Response>;
/** `GET /api/cms/v1/public/entries/:collection/:slug?locale` — a single published entry. For an old address, reports the canonical address as `address`. */
export declare function getOne(request: Request, params: {
    collection: string;
    slug: string;
}, cms: Cms): Promise<Response>;
