/**
 * The small rules about single values that the config check, the schema file, the CLI prompts and the admin forms all apply. They live here, once, and
 * depend on nothing, so every one of those can import them.
 */

/** Shape of an ID (UUID) of content, folders, media and seed templates. */
export const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const UUID_PATTERN = new RegExp(`^${UUID_SOURCE}$`, "i");

/** A name for a collection or a field: what stored values, JSON keys and URLs call it. */
export const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** A select option's value: the key stored for the choice. */
export const OPTION_VALUE_PATTERN = /^[A-Za-z0-9_-]+$/;

/** A host name with an optional port (`www.example.com`, `localhost:3000`), as `site.aliases` lists them. */
export const HOST_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:\d+)?$/;

/** Shape of the query name that carries the locale in preview URLs (`site.previewLocaleParam`). */
export const PREVIEW_PARAM_NAME = /^[A-Za-z][\w-]*$/;

/** Host names that mean the machine itself: a URL on one of them is for local work only. */
const LOCAL_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

/** Whether the URL points at the local machine (`localhost`, `127.0.0.1`, `[::1]` or a `.localhost` name). `false` for anything that is not an http(s) URL. */
export const isLocalUrl = (value: string): boolean => {
	try {
		const { hostname, protocol } = new URL(value);
		if (protocol !== "http:" && protocol !== "https:") return false;
		return LOCAL_HOSTS.includes(hostname) || hostname.endsWith(".localhost");
	} catch {
		return false;
	}
};

/** Shape of a locale code (the language and region/script parts of BCP 47). */
export const LOCALE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** How public URLs get a locale prefix (`site.localePrefix`). */
export type LocalePrefixMode = "except-default" | "always" | "never";
export const LOCALE_PREFIX_MODES: readonly LocalePrefixMode[] = ["except-default", "always", "never"];

/** Default admin UI path (when `admin.path` is unset). */
export const DEFAULT_ADMIN_PATH = "/admin";

/** Admin path shape: a path of one or more segments starting with `/` (no trailing `/`), and not under `/api`. */
export const isAdminPath = (path: string): boolean =>
	/^(\/[A-Za-z0-9._~-]+)+$/.test(path) && !/^\/api(\/|$)/.test(path);

/** `site.home`: a path (`/`) or an http(s) URL. */
export const isHomeHref = (href: string): boolean => {
	if (href.startsWith("/")) return !href.startsWith("//");
	return isHttpUrl(href);
};

/** Whether the value is an http(s) URL. */
export const isHttpUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

/** Whether the name is an IANA time zone this runtime knows. */
export const isTimeZone = (timeZone: string): boolean => {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return true;
	} catch {
		return false;
	}
};
