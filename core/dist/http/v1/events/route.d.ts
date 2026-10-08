/** `GET /v1/events`: the deliveries of the event outbox (default: the failed and dead ones, newest first) and how many there are in each state. */
export declare const GET: (request: Request, context?: Partial<import("../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;
