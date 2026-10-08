/**
 * Small rules of the site config that both the config check (`define.ts`) and the schema file check (`schema-file/`) apply. They live here so neither imports the other.
 */
/** Shape of a locale code (the language and region/script parts of BCP 47). */
export const LOCALE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
export const LOCALE_PREFIX_MODES = ["except-default", "always", "never"];
/** Default admin UI path (when `admin.path` is unset). */
export const DEFAULT_ADMIN_PATH = "/admin";
/** Admin path shape: a path of one or more segments starting with `/` (no trailing `/`), and not under `/api`. */
export const isAdminPath = (path) => /^(\/[A-Za-z0-9._~-]+)+$/.test(path) && !/^\/api(\/|$)/.test(path);
/** `site.home`: a path (`/`) or an http(s) URL. */
export const isHomeHref = (href) => {
    if (href.startsWith("/"))
        return !href.startsWith("//");
    return isHttpUrl(href);
};
/** Whether the value is an http(s) URL. */
export const isHttpUrl = (value) => {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    }
    catch {
        return false;
    }
};
/** Whether the name is an IANA time zone this runtime knows. */
export const isTimeZone = (timeZone) => {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone });
        return true;
    }
    catch {
        return false;
    }
};
