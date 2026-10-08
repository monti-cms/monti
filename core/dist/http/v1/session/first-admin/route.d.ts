import type { RouteContext } from "../../handler.js";
/**
 * `POST /api/cms/v1/session/first-admin`: creates the first admin account of the built-in email and password login, then signs that account in. A plain form post from the
 * login screen, which shows the form only while no account exists. That is not what guards it: once any account exists the login refuses the request itself (`closed`), whatever
 * the browser sent. Needs no login (there is no account to log in with yet), but the same-origin check applies. A refusal sends the browser back to the login screen with `?error=<reason>`.
 */
export declare const POST: (request: Request, context: RouteContext) => Promise<Response>;
