/**
 * `POST /v1/events/retry[?all=1&limit=100]`: delivers the events that are due (with `all`, also the failed ones that are not due yet). It is the endpoint a cron job
 * calls on a serverless host that has no worker. It takes an admin session, or `Authorization: Bearer <events.retrySecret>` when the server config has a
 * `retrySecret` (a bearer request needs no same-origin check: it carries no cookie). The route is public for the router, because it decides the login itself.
 */
export declare const POST: import("../../handler.js").PublicHandler<{
    [x: string]: string;
}>;
