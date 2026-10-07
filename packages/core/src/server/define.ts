import type { MediaStore } from "../adapters/r2/types";
import type { ContentStore } from "../core/store";
import type { FormatRegistry } from "../format/registry";
import type { PublicApiOptions } from "../http/v1/public/options";
import type { PluginStorage } from "../plugin/storage";
import type { EventDeliveryOptions } from "../services/events";
import type { WriteHooks } from "../services/hooks";
import type { Site } from "../site";

/**
 * Server config (`cms.server.ts`) schema. Holds the store, media and login connections and secrets. Read on the server only.
 * Unlike the site config (`cms.config.ts`), it may hold secrets, and usually reads them from environment variables.
 *
 * Connections are created on first use. Reading the config where environment variables are absent, such as during a build, does not fail.
 */

/** Content store connection. */
export interface DatabaseAdapter {
	readonly name: string;
	/**
	 * Creates the store. `site` is the instance's site (its collections, locales, blocks, links). The store writes the events of every change (the outbox,
	 * `EventStore`) in the transaction of the change; the core delivers them (`afterCommit` of the server config and plugins) after the commit.
	 */
	createStore(options: { readonly site: Site }): ContentStore;
	/** Creates the tables or brings them to the latest shape (`monti migrate`). Running it repeatedly gives the same result. */
	migrate(options: { readonly site: Site; readonly formats?: FormatRegistry }): Promise<void>;
	/**
	 * The storage of one plugin (`cms.storage(name)`): documents in named collections, scoped to the plugin. It needs the tables `migrate()` creates.
	 * An adapter implements it over its own database; plugins never see the database.
	 */
	pluginStorage(plugin: string): PluginStorage;
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
	/** Name the login method gives the user (the GitHub name or login). Recorded as who made a change, and shown when someone else saved first. */
	name?: string;
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
	session(): Promise<{ user?: { id?: string; accountId?: string; name?: string } } | null>;
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
	/**
	 * Headers of the request being handled, or `null` outside a request. Supplied by the login connection because reading the current request
	 * is something the host framework does (the Next.js one reads `next/headers`). Without it, the development bypass never applies.
	 */
	requestHeaders?(): Promise<Pick<Headers, "get"> | null>;
	/**
	 * Throws `error` again when it is not a failure but a signal the host framework uses to leave the handler (Next.js throws a redirect to
	 * send the browser away after `signIn` and `signOut`), so it reaches the framework instead of becoming an API error. Does nothing otherwise.
	 */
	rethrow?(error: unknown): void;
}

/** Values the core passes when creating the login connection. */
export interface AuthCreateContext {
	/** The instance's site: the login connection takes the language of its texts (`site.createTranslator`) from it. */
	readonly site: Site;
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
	 * The master secret. Plugins never receive it: the instance derives a separate key per plugin from it and gives each plugin an API to encrypt
	 * stored values (AI service keys) with that key. Without it, such values cannot be stored.
	 * To change it without losing stored values, move the old one to `previousSecrets`.
	 */
	readonly secret?: string;
	/**
	 * Secrets `secret` replaced. Values encrypted with them stay readable and are encrypted again with `secret` the next time they are saved
	 * (the AI plugin also does it on `monti migrate`). Drop a secret from the list only after its values are re-encrypted.
	 */
	readonly previousSecrets?: readonly string[];
	/**
	 * Hooks on every content write: `transform` (change the data before it is prepared), `validate` and `validatePublish` (add failures and warnings), and
	 * `afterCommit` (notification after the change is committed: cache refresh, webhooks, search indexing; the change stands even if it fails, and a failed
	 * delivery is retried, so it must be idempotent). They run before the plugins' hooks of the same name. See "Hook contract" in the core README.
	 */
	readonly hooks?: WriteHooks;
	/** How `afterCommit` deliveries are retried and kept, and the secret of the retry route. See "Event delivery" in the core README. */
	readonly events?: EventDeliveryOptions;
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
