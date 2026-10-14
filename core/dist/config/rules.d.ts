/**
 * The small rules about single values that the config check, the schema file, the CLI prompts and the admin forms all apply. They live here, once, and
 * depend on nothing, so every one of those can import them.
 */
/** Shape of an ID (UUID) of content, folders, media and seed templates. */
export declare const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export declare const UUID_PATTERN: RegExp;
/** A name for a collection or a field: what stored values, JSON keys and URLs call it. */
export declare const NAME_PATTERN: RegExp;
/** A select option's value: the key stored for the choice. */
export declare const OPTION_VALUE_PATTERN: RegExp;
/** A host name with an optional port (`www.example.com`, `localhost:3000`), as `site.aliases` lists them. */
export declare const HOST_PATTERN: RegExp;
/** Shape of the query name that carries the locale in preview URLs (`site.previewLocaleParam`). */
export declare const PREVIEW_PARAM_NAME: RegExp;
/** Whether the URL points at the local machine (`localhost`, `127.0.0.1`, `[::1]` or a `.localhost` name). `false` for anything that is not an http(s) URL. */
export declare const isLocalUrl: (value: string) => boolean;
/** Shape of a locale code (the language and region/script parts of BCP 47). */
export declare const LOCALE_CODE: RegExp;
/** How public URLs get a locale prefix (`site.localePrefix`). */
export type LocalePrefixMode = "except-default" | "always" | "never";
export declare const LOCALE_PREFIX_MODES: readonly LocalePrefixMode[];
/** Default admin UI path (when `admin.path` is unset). */
export declare const DEFAULT_ADMIN_PATH = "/admin";
/**
 * Admin path shape: a path of one or more segments starting with `/` (no trailing `/`), and not under `/api`. A segment is plain: the admin path becomes a folder of the
 * app (`app/(admin)/studio/[[...path]]`), so it holds letters, digits, `-` and `_` only.
 */
export declare const isAdminPath: (path: string) => boolean;
/** `site.home`: a path (`/`) or an http(s) URL. */
export declare const isHomeHref: (href: string) => boolean;
/** Whether the value is an http(s) URL. */
export declare const isHttpUrl: (value: string) => boolean;
/** Whether the name is an IANA time zone this runtime knows. */
export declare const isTimeZone: (timeZone: string) => boolean;
/** The language's name written in that language (`ko` gives its Hangul name), or the code itself when the runtime does not know it. */
export declare const languageName: (code: string) => string;
