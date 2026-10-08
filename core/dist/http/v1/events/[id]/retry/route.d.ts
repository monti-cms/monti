/** `POST /v1/events/<id>/retry` with `{ subscriber }`: puts a failed or dead delivery back and tries it now. 404 when there is no such failed or dead delivery. */
export declare const POST: (request: Request, context?: Partial<import("../../../handler.js").RouteContext<{
    id: string;
}>> | undefined) => Promise<Response>;
