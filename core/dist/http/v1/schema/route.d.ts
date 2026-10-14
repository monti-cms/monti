/**
 * The schema settings API. `GET` reads the schema file (and works everywhere: a production server only reads it). `PUT` saves an edit and `POST .../preview` checks one;
 * both write routes answer **403 `schema_read_only`** unless the server runs in development and the file can be written, whatever the screen shows. Admin only like every
 * route.
 */
export declare const GET: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;
export declare const PUT: import("../handler.js").AdminHandler<{
    [x: string]: string;
}>;
