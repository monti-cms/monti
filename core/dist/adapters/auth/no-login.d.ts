import { type AuthAdapter } from "../../server/define.js";
/**
 * The login of a config that names none (`auth` left out of `defineConfig`). Nobody can sign in: under `next dev` the development bypass lets the
 * machine's own requests into the admin, everywhere else the admin refuses everyone and the login screen says that no login is configured.
 */
export declare function noLogin(): AuthAdapter;
