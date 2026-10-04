/**
 * Base path of the login API. The admin API catch-all (`app/api/cms/[...path]/route.ts`) hands everything under it (`/api/cms/auth/*`) to the
 * login connection, so no separate login route file is needed.
 */
export const CMS_AUTH_BASE_PATH = "/api/cms/auth";
/** Defines the server config. */
export const defineServerConfig = (config) => config;
