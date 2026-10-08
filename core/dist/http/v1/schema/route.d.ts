/**
 * The schema settings API. `GET` reads the schema file (and works everywhere: a production server only reads it). `PUT` saves an edit and `POST .../preview` checks one;
 * both write routes answer **403 `schema_read_only`** unless the server runs in development and the file can be written, whatever the screen shows. Admin only like every
 * route.
 */
export declare const GET: (request: Request, context?: Partial<import("../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;
export declare const PUT: (request: Request, context?: Partial<import("../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;
