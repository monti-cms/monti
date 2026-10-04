import type { ResolvedBareunOptions } from "./options.js";
/**
 * Bareun check route (`POST /api/cms/v1/text-check/bareun`). Admin only. Takes `{ segments }` and returns `{ issues }`.
 * Without a key it does not call Bareun and returns 503. Bareun errors are turned into a generic error (502) by the check route helper (`textCheckRoute`).
 */
export declare function bareunRoute(options: ResolvedBareunOptions): {
    POST: (request: import("next/server").NextRequest, context?: {
        params: Promise<{
            [x: string]: string;
        }>;
    } | undefined) => Promise<Response>;
};
