/**
 * Small rules of the site config that both the config check (`define.ts`) and the schema file check (`schema-file/`) apply. They live here so neither imports the other.
 */
/** Shape of a locale code (the language and region/script parts of BCP 47). */
export declare const LOCALE_CODE: RegExp;
/** How public URLs get a locale prefix (`site.localePrefix`). */
export type LocalePrefixMode = "except-default" | "always" | "never";
export declare const LOCALE_PREFIX_MODES: readonly LocalePrefixMode[];
/** Default admin UI path (when `admin.path` is unset). */
export declare const DEFAULT_ADMIN_PATH = "/admin";
/** Admin path shape: a path of one or more segments starting with `/` (no trailing `/`), and not under `/api`. */
export declare const isAdminPath: (path: string) => boolean;
/** `site.home`: a path (`/`) or an http(s) URL. */
export declare const isHomeHref: (href: string) => boolean;
/** Whether the value is an http(s) URL. */
export declare const isHttpUrl: (value: string) => boolean;
/** Whether the name is an IANA time zone this runtime knows. */
export declare const isTimeZone: (timeZone: string) => boolean;
