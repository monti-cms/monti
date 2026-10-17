/**
 * Bareun check route (`POST /api/monti/v1/text-check/bareun`). Admin only. Takes `{ segments }` and returns `{ issues }`.
 * The settings are those of the Bareun plugin in the site config of the instance that serves the request.
 * Without a key it does not call Bareun and returns 503. Bareun errors are turned into a generic error (502) by the check route helper (`handleTextCheck`).
 */
export declare function bareunRoute(): {
    POST: import("@monti-cms/core/server").AdminHandler<{
        [x: string]: string;
    }>;
};
