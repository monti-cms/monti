/**
 * Collection definitions (`schemas` and the summarized v1-shaped `definitions`), body block definitions (`blocks`), and server limits (§5.6 "the server config and
 * API metadata show the same limits"). The field character limit is the field's `max` in `schemas` (the title too).
 */
export declare const GET: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
