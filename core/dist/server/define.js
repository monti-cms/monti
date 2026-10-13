/**
 * Base path of the login API. The admin API catch-all (`app/api/monti/[...path]/route.ts`) hands everything under it (`/api/monti/auth/*`) to the
 * login connection, so no separate login route file is needed.
 */
export const CMS_AUTH_BASE_PATH = "/api/monti/auth";
