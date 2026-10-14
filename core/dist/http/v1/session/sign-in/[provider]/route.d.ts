/**
 * `POST /api/monti/v1/session/sign-in/<method>`: starts signing in with one of the login methods (`cms.auth().providers`). The login screen submits a plain form here.
 * Needs no login (it is how one signs in), but the same-origin check applies. On success the login connection redirects the browser (to the provider, then to the admin).
 *
 * It is a route and not a server action because a server action cannot carry the CMS instance: its closed-over values must be serializable.
 */
export declare const POST: import("../../../handler.js").PublicHandler<{
    provider: string;
}>;
