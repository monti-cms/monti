import type { NextRequest } from "next/server";
/** `GET /api/cms/v1/public/entries?collection&page&pageSize&locale&<filters>` — published list (newest publish date first). */
export declare function GET(request: NextRequest): Promise<Response>;
/** `GET /api/cms/v1/public/entries/:collection/:slug?locale` — a single published entry. For an old address, reports the canonical address as `address`. */
export declare function getOne(request: NextRequest, params: {
    collection: string;
    slug: string;
}): Promise<Response>;
