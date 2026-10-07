import type { BlockDefinition } from "../blocks/define";
import { type Cms, createCms } from "../cms";
import {
	type CmsConfig,
	type CollectionsConfig,
	defineConfig as defineSiteConfig,
	type SchemaCmsConfig,
} from "../config/define";
import type { PublicApiOptions } from "../http/v1/public/options";
import type { CmsPlugin } from "../plugin/define";
import type { SchemaCollectionsOf, SchemaInput, SchemaLocalesOf } from "../schema-file/types";
import type { EventDeliveryOptions } from "../services/events";
import type { WriteHooks } from "../services/hooks";
import type { AuthAdapter, CmsServerConfig, DatabaseAdapter, MediaAdapter } from "./define";

/** The environment variable the one master secret is read from when `secret` is not given. */
export const SECRET_ENV = "MONTI_SECRET";

/**
 * What `monti.config.ts` says about the server, next to the site options (`schema`, `plugins`, ...). Everything but `database` and `auth` is optional.
 * It is read on the server only, so it may name secrets; the usual way is to leave them to the environment (`postgres()` reads `DATABASE_URL`, `github()`
 * reads `AUTH_GITHUB_ID`, and `MONTI_SECRET` is the secret).
 */
export interface MontiServerOptions {
	/** Where the content lives (`postgres()`). */
	readonly database: DatabaseAdapter;
	/** How admins log in (`auth({ providers: [github()] })` of `@monti-cms/auth`). */
	readonly auth: AuthAdapter;
	/**
	 * Where uploaded images and files go: a storage adapter from any package (for example the S3-compatible one). Without it, media upload and management
	 * are unavailable and the admin hides the media menu.
	 */
	readonly storage?: MediaAdapter;
	/**
	 * The one master secret. If unset, the `MONTI_SECRET` environment variable (any long random value, for example `openssl rand -base64 32`).
	 * The login's session-signing key and the encryption key of every plugin (AI service keys, git-sync tokens) are derived from it with HKDF, so one value
	 * covers them all and none of them sees the secret itself. Without it the login cannot sign sessions and stored values cannot be encrypted.
	 */
	readonly secret?: string | undefined;
	/**
	 * Secrets `secret` replaced. Values encrypted with them stay readable and are encrypted again with `secret` the next time they are saved. To keep the
	 * values stored under the old `CMS_SECRET`, either set `MONTI_SECRET` to that value or list it here (`previousSecrets: [process.env.CMS_SECRET]`).
	 * Drop a secret from the list only after its values are re-encrypted.
	 */
	readonly previousSecrets?: readonly (string | undefined)[];
	/**
	 * Whether the server sits behind a proxy that sets `Host` and `X-Forwarded-Host`, so login callback URLs may be built from them. An explicit value always
	 * wins; else the `AUTH_TRUST_HOST` environment variable; else it is on when a known proxy platform is detected (`VERCEL`, `NETLIFY`, `CF_PAGES`, ...)
	 * and in development, and off in any other production. A proxy you run yourself (nginx, a load balancer) needs `true`, and only if it overwrites
	 * `X-Forwarded-Host`: with it on, a client could otherwise choose the host a login callback is built from.
	 */
	readonly trustHost?: boolean;
	/** Hooks on every content write; see "Hook contract" in the core README. They run before the plugins' hooks of the same name. */
	readonly hooks?: WriteHooks;
	/** How `afterCommit` deliveries are retried and kept, and the secret of the retry route. */
	readonly events?: EventDeliveryOptions;
	/** Public JSON API (`/api/cms/v1/public/*`). Off if unset (404). */
	readonly publicApi?: PublicApiOptions;
}

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
] as const satisfies readonly (keyof MontiServerOptions)[];

const isServerKey = (key: string): key is (typeof SERVER_KEYS)[number] =>
	(SERVER_KEYS as readonly string[]).includes(key);

/**
 * The one config of a Monti site, and the CMS instance it makes. `monti.config.ts` exports the result as `cms`; the admin API route, the admin page, the
 * site's pages and the `monti` command all use that one instance.
 *
 * ```ts
 * export const cms = defineConfig({
 *   schema,                                  // monti.schema.json: collections, fields, locales (the data)
 *   plugins: [mdx(), callout(), seo()],      // one line per feature, each works with no arguments
 *   database: postgres(),                    // DATABASE_URL, DATABASE_SCHEMA
 *   auth: auth({ providers: [github()] }),   // AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, MONTI_ADMIN_GITHUB_ID
 * });
 * ```
 *
 * It takes the site options of `defineConfig` of `@monti-cms/core` (`schema` or `collections` and `locales`, `plugins`, `blocks`, `site`, `admin`, ...) and the
 * server options ({@link MontiServerOptions}). Connections are created on first use, so importing this file where the environment is absent (a build) does not fail.
 * The file is server-only: the admin gets a JSON snapshot of the site, never the file, and importing it into a client bundle throws.
 */
export function defineConfig<
	const Schema extends SchemaInput,
	const Collections extends CollectionsConfig = Record<never, never>,
	const Plugins extends readonly CmsPlugin[] = readonly [],
	const Blocks extends readonly BlockDefinition[] = readonly [],
>(
	config: SchemaCmsConfig<Schema, Collections, Plugins, Blocks> & MontiServerOptions,
): Cms<CmsConfig<SchemaCollectionsOf<Schema> & Collections, SchemaLocalesOf<Schema>, Plugins, Blocks>>;
export function defineConfig<
	const Collections extends CollectionsConfig,
	const Locale extends string,
	const Plugins extends readonly CmsPlugin[] = readonly [],
	const Blocks extends readonly BlockDefinition[] = readonly [],
>(
	config: CmsConfig<Collections, Locale, Plugins, Blocks> & MontiServerOptions,
): Cms<CmsConfig<Collections, Locale, Plugins, Blocks>>;
export function defineConfig(input: MontiServerOptions): Cms {
	if (typeof window !== "undefined") {
		throw new Error(
			"monti.config.ts was loaded in the browser. It holds the database and login settings and is server-only: import it from server code (route files, server components, " +
				"scripts), never from a file with 'use client' or a file such a file imports. The admin gets the site as data from its layout.",
		);
	}
	if (!input.database) {
		throw new Error(
			"monti: defineConfig needs a `database`, for example `database: postgres()` (postgres is exported by @monti-cms/core/server).",
		);
	}
	if (!input.auth) {
		throw new Error(
			"monti: defineConfig needs `auth`, for example `auth: auth({ providers: [github()] })` (auth is exported by @monti-cms/auth).",
		);
	}
	const site: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input as object)) if (!isServerKey(key)) site[key] = value;
	const config = defineSiteConfig(site as never);
	const server: CmsServerConfig = {
		database: input.database,
		auth: input.auth,
		...(input.storage ? { media: input.storage } : {}),
		secret: input.secret || process.env[SECRET_ENV] || undefined,
		...(input.previousSecrets
			? { previousSecrets: input.previousSecrets.filter((secret): secret is string => Boolean(secret)) }
			: {}),
		...(input.trustHost !== undefined ? { trustHost: input.trustHost } : {}),
		...(input.hooks ? { hooks: input.hooks } : {}),
		...(input.events ? { events: input.events } : {}),
		...(input.publicApi ? { publicApi: input.publicApi } : {}),
	};
	return createCms({ config, server });
}
