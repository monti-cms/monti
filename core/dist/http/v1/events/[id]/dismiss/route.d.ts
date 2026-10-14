/** `POST /v1/events/<id>/dismiss` with `{ subscriber }`: gives up on a failed or dead delivery. 404 when there is no such failed or dead delivery. */
export declare const POST: import("../../../handler.js").AdminHandler<{
    id: string;
}>;
