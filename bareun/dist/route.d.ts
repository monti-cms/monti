/**
 * Bareun check route (`POST /api/cms/v1/text-check/bareun`). Admin only. Takes `{ segments }` and returns `{ issues }`.
 * The settings are those of the Bareun plugin in the site config of the instance that serves the request.
 * Without a key it does not call Bareun and returns 503. Bareun errors are turned into a generic error (502) by the check route helper (`handleTextCheck`).
 */
export declare function bareunRoute(): {
    POST: (request: Request, context?: Partial<import("@monti-cms/core/plugin/server").RouteContext<{
        [x: string]: string;
    }>> | undefined) => Promise<Response>;
};
