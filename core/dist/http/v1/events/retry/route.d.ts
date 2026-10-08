import { type RouteContext } from "../../handler.js";
/**
 * `POST /v1/events/retry[?all=1&limit=100]`: delivers the events that are due (with `all`, also the failed ones that are not due yet). It is the endpoint a cron job
 * calls on a serverless host that has no worker. It takes an admin session, or `Authorization: Bearer <events.retrySecret>` when the server config has a
 * `retrySecret` (a bearer request needs no same-origin check: it carries no cookie).
 */
export declare const POST: (request: Request, context?: Partial<RouteContext>) => Promise<Response>;
