/**
 * `POST /v1/events/retry[?all=1&limit=100]`: delivers the events that are due (with `all`, also the failed ones that are not due yet). It is the endpoint a cron job
 * calls on a serverless host that has no worker. Access `admin-or-bearer`: the router guards a request without a token like any admin route, and a bearer request
 * (`Authorization: Bearer <events.retrySecret>`, when the server config has a `retrySecret`) reaches this handler, which verifies the token. It carries no cookie, so it needs no same-origin check.
 */
export declare const POST: import("../../handler.js").BearerHandler<{
    [x: string]: string;
}>;
