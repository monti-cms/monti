/** `POST /v1/events/<id>/dismiss` with `{ subscriber }`: gives up on a failed or dead delivery. 404 when there is no such failed or dead delivery. */
export declare const POST: (request: Request, context?: Partial<import("../../../handler.js").RouteContext<{
    id: string;
}>> | undefined) => Promise<Response>;
