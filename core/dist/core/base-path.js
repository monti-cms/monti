/**
 * Address rules that do not read the site config (`basePath` and the admin API address). The adapter used by the server config (`cms.server.ts`) also reads this, so
 * it must not import modules that load the config.
 */
/** Admin API path prefix (location of `app/api/cms/[...path]/route.ts`). */
export const CMS_API_PATH = "/api/cms";
/** Normalizes a `basePath` value to `""` (none) or `/folder` (leading `/`, no trailing `/`). */
export function normalizeBasePath(value) {
    const trimmed = (value ?? "").trim().replace(/\/+$/, "");
    if (trimmed === "")
        return "";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
/**
 * The sub-path the app is mounted under (Next `basePath`), or `""` if none. `withCms` injects the Next config's `basePath`
 * into both the server and browser bundles, so site code does nothing.
 * Read on every call (the bundler replaces the expression below with a value, and tests can change the environment variable).
 */
export function cmsBasePath() {
    try {
        return normalizeBasePath(process.env.NEXT_PUBLIC_CMS_BASE_PATH);
    }
    catch {
        return "";
    }
}
/**
 * The address the browser actually opens (including `basePath`). `path` is `/…`.
 * Next's `Link`, `router` and `redirect()` add `basePath` themselves, so do not use this there (it would be applied twice) —
 * use it where Next does not touch the address, such as `fetch`, `window.open`, `history` and login `redirectTo`.
 */
export const withBasePath = (path) => `${cmsBasePath()}${path}`;
/**
 * Admin API address. `cmsApiUrl("/v1/entries?page=2")` is `/api/cms/v1/entries?page=2` (prefixed with `basePath` if set).
 * Every API call from the admin screen and extensions builds its address with this function.
 */
export function cmsApiUrl(path) {
    if (!path.startsWith("/"))
        throw new Error(`cmsApiUrl: "${path}" must start with "/"`);
    return withBasePath(`${CMS_API_PATH}${path}`);
}
/** Admin address rules that do not read the config. `path` is an empty string, `/…` or `?…`. */
export function adminHrefWith(base, path = "") {
    if (path !== "" && !path.startsWith("/") && !path.startsWith("?")) {
        throw new Error(`adminHref: "${path}" must start with "/" or "?"`);
    }
    return `${base}${path === "/" ? "" : path}`;
}
