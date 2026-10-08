import { createCms } from "../cms/index.js";
import { defineSite } from "../config/define.js";
import { problemText } from "../core/problem.js";
/** The environment variable the public site URL is read from when neither `site.url` nor the schema file sets it. */
export const SITE_URL_ENV = "SITE_URL";
/** The environment variable the one master secret is read from when `secret` is not given. */
export const SECRET_ENV = "MONTI_SECRET";
const SERVER_KEYS = [
    "database",
    "auth",
    "storage",
    "secret",
    "previousSecrets",
    "trustHost",
    "hooks",
    "events",
    "publicApi",
];
const isServerKey = (key) => SERVER_KEYS.includes(key);
export function defineConfig(input) {
    if (typeof window !== "undefined") {
        throw new Error(problemText({
            what: "monti.config.ts was loaded in the browser, but it holds the database and login settings and is server-only",
            where: "the import chain from a file with 'use client' to monti.config.ts (`monti doctor` prints it)",
            fix: "import the config only from server code (route files, server components, scripts); a client component gets data as props or through the API route. The admin gets the site as data from its layout",
        }));
    }
    if (!input.database) {
        throw new Error(problemText({
            what: "defineConfig has no `database`, so there is nowhere to keep the content",
            where: "defineConfig({ ... }) in monti.config.ts",
            fix: "add `database: postgres()` (postgres is exported by @monti-cms/core/server); it reads DATABASE_URL",
        }));
    }
    if (!input.auth) {
        throw new Error(problemText({
            what: "defineConfig has no `auth`, so there is no way to log in to the admin",
            where: "defineConfig({ ... }) in monti.config.ts",
            fix: "add `auth: auth({ providers: [github()] })` (auth is exported by @monti-cms/auth, github by @monti-cms/auth/github)",
        }));
    }
    const site = {};
    for (const [key, value] of Object.entries(input))
        if (!isServerKey(key))
            site[key] = value;
    // The public site URL by convention: `SITE_URL`, unless the code (`site.url`) or the schema file says it.
    const schema = site.schema;
    const fileUrl = typeof schema === "object" ? schema?.site?.url : undefined;
    const siteOptions = site.site;
    const envUrl = process.env[SITE_URL_ENV]?.trim();
    if (!siteOptions?.url && !fileUrl && envUrl)
        site.site = { ...siteOptions, url: envUrl };
    const siteUrlSource = siteOptions?.url
        ? "set in monti.config.ts (site.url)"
        : fileUrl
            ? "set in the schema file (site.url)"
            : envUrl
                ? `from env ${SITE_URL_ENV}`
                : undefined;
    const config = defineSite(site);
    const server = {
        database: input.database,
        auth: input.auth,
        ...(input.storage ? { media: input.storage } : {}),
        secret: input.secret || process.env[SECRET_ENV] || undefined,
        ...(input.previousSecrets
            ? { previousSecrets: input.previousSecrets.filter((secret) => Boolean(secret)) }
            : {}),
        ...(input.trustHost !== undefined ? { trustHost: input.trustHost } : {}),
        ...(input.hooks ? { hooks: input.hooks } : {}),
        ...(input.events ? { events: input.events } : {}),
        ...(input.publicApi ? { publicApi: input.publicApi } : {}),
    };
    return createCms({ config, server, ...(siteUrlSource ? { siteUrlSource } : {}) });
}
