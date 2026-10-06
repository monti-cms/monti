import type { AfterCommit, ContentStore } from "../adapters/postgres/content-store";
import type { MediaStore } from "../adapters/r2/types";
import type { PublicApiOptions } from "../http/v1/public/options";
import type { PluginDatabase } from "../plugin/define";

/**
 * Server config (`cms.server.ts`) schema. Holds the store, media and login connections and secrets. Read on the server only.
 * Unlike the site config (`cms.config.ts`), it may hold secrets, and usually reads them from environment variables.
 *
 * Connections are created on first use. Reading the config where environment variables are absent, such as during a build, does not fail.
 */

/** Content store connection. */
export interface DatabaseAdapter {
	readonly name: string;
	/** Creates the store. `afterCommit` is passed in by the core (after-save notifications from the server config and plugins). */
	createStore(options?: { readonly afterCommit?: AfterCommit }): ContentStore;
	/** Creates the tables or brings them to the latest shape (`monti migrate`). Running it repeatedly gives the same result. */
	migrate(): Promise<void>;
	/** Connection for plugins to create and read their own tables (`CmsServerPlugin.migrate`, plugin API). */
	pluginDatabase(): PluginDatabase;
	/** Closes the connection (when the command-line tool finishes). */
	close?(): Promise<void>;
}

/** Media (image and attachment) store connection. */
export interface MediaAdapter {
	readonly name: string;
	createStore(): MediaStore;
}

/** Result of the admin login check. */
export interface AuthContext {
	userId: string;
	isAdmin: boolean;
	/** Account ID of the login method (numeric ID for GitHub). Compared against the admin list. */
	accountId: string;
}

/** One login button on the login page. */
export interface AuthProvider {
	/** Login method name passed to `signIn(id)` (e.g. `github`). */
	readonly id: string;
	/** Display name of the login method (e.g. `GitHub`). Used in permission messages. */
	readonly name: string;
	/** Button text (e.g. `Sign in with GitHub`). */
	readonly label: string;
}

/**
 * Base path of the login API. The admin API catch-all (`app/api/cms/[...path]/route.ts`) hands everything under it (`/api/cms/auth/*`) to the
 * login connection, so no separate login route file is needed.
 */
export const CMS_AUTH_BASE_PATH = "/api/cms/auth";

/** Admin login. Provides the Next routes (`handlers`) and the admin check together. */
export interface CmsAuth {
	/**
	 * Login API path (e.g. `/api/cms/auth`). If it is `CMS_AUTH_BASE_PATH`, the admin API catch-all hands requests to `handlers`.
	 * For another path, the app puts a route file at that path and exports `handlers` from `@monti-cms/core/runtime`.
	 */
	readonly basePath?: string;
	/** Login API route handlers (requests under `basePath`). */
	readonly handlers: {
		GET(request: Request): Promise<Response>;
		POST(request: Request): Promise<Response>;
	};
	/** Current session. `null` if none. */
	session(): Promise<{ user?: { id?: string; accountId?: string } } | null>;
	/** Login methods to show on the login page. */
	readonly providers: readonly AuthProvider[];
	signIn(provider?: string, options?: { redirectTo?: string }): Promise<unknown>;
	signOut(options?: { redirectTo?: string }): Promise<unknown>;
	/** Whether this user is an admin. */
	isAdmin(userId: string | null | undefined): boolean;
	/** Whether the local development bypass, which treats the user as admin without login, is on. */
	readonly devBypass: boolean;
	/** Admin ID to use for the development bypass. */
	readonly devUserId: string;
}

/** Values the core passes when creating the login connection. */
export interface AuthCreateContext {
	/** Whether the `Host` header may be trusted to build login callback URLs (see `trustHost` in the server config). */
	readonly trustHost: boolean;
	/** Admin login page URL (admin path + `/login`, e.g. `/admin/login`). Includes the Next `basePath` if set, so it is the browser-facing URL. */
	readonly loginPath: string;
}

export interface AuthAdapter {
	readonly name: string;
	create(context: AuthCreateContext): CmsAuth;
}

export interface CmsServerConfig {
	readonly database: DatabaseAdapter;
	/** Without it, media upload and management are unavailable. */
	readonly media?: MediaAdapter;
	readonly auth: AuthAdapter;
	/**
	 * Secret encryption key (for storing AI service keys in the DB). Changing it makes stored keys undecryptable, so they must be entered again.
	 * Without it, AI service keys cannot be stored.
	 */
	readonly secret?: string;
	/**
	 * Notification after a save (cache refresh, webhooks, search indexing). Called after a change that creates, saves, publishes, archives, trashes, restores or deletes an entry is committed.
	 * The save stands even if it fails (the error is only logged). Plugins' `afterCommit` is called too.
	 */
	readonly afterCommit?: AfterCommit;
	/**
	 * Whether the server sits behind a proxy or platform (Vercel, nginx, a load balancer) that sets `Host` and `X-Forwarded-Host`.
	 * When on, login callback URLs are built from the request host and the same-origin check accepts `X-Forwarded-Host`;
	 * when off, a client-supplied `X-Forwarded-Host` is ignored and login needs `AUTH_URL`. Default: the `AUTH_TRUST_HOST` environment variable
	 * (`true`/`1` or `false`/`0`), else off in production and on in development.
	 */
	readonly trustHost?: boolean;
	/** Public JSON API (`/api/cms/v1/public/*`). Off if unset (404). */
	readonly publicApi?: PublicApiOptions;
}

/** Defines the server config. */
export const defineServerConfig = <const C extends CmsServerConfig>(config: C): C => config;
