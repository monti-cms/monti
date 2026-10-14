/** `GET /v1/events`: the deliveries of the event outbox (default: the failed and dead ones, newest first) and how many there are in each state. */
export declare const GET: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;
