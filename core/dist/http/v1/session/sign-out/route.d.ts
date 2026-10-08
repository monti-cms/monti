import type { RouteContext } from "../../handler.js";
/** `POST /api/cms/v1/session/sign-out`: signs out and sends the browser to the login screen. A plain form post from the login screen, with the same-origin check. */
export declare const POST: (request: Request, context: RouteContext) => Promise<Response>;
