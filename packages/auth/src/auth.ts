import { Auth, type AuthConfig, skipCSRFCheck } from "@auth/core";
import { defineMessages, type MessageBundle } from "@monti-cms/core";
import { assertDevBypassSafe, isDevAuthBypassEnabled, withBasePath } from "@monti-cms/core/adapters/auth";
import { type AuthAdapter, CMS_AUTH_BASE_PATH, type CmsAuth } from "@monti-cms/core/server";
import { type LoginProvider, qualifyAccountId, splitAccountId } from "./provider";

/**
 * What the host framework supplies, so this package stays free of any framework. The core cannot know the current request on its own,
 * and a framework may leave a handler by throwing (Next.js redirects that way). `@monti-cms/nextjs/auth` exports the Next.js one.
 */
export interface AuthHost {
	/** Headers of the request being handled, or `null` outside a request. Without it, `session()` needs the request passed in and the development bypass never applies. */
	requestHeaders?(): Promise<Pick<Headers, "get"> | null>;
	/** Throws `error` again when it is a signal the framework uses to leave the handler, so it is not turned into an API error. Does nothing otherwise. */
	rethrow?(error: unknown): void;
}

export interface AuthOptions {
	/** The ways to log in. At least one; ids must be different. */
	readonly providers: readonly LoginProvider[];
	/**
	 * Admins by qualified account id (`github:12345678`). The ones listed on a provider (`github({ admins })`) count too; this is for ids
	 * you would rather keep in one place. With none anywhere, nobody is an admin.
	 */
	readonly admins?: readonly (string | undefined)[];
	/**
	 * Treats requests from this machine as admin without login, in local development. On by default under `next dev` (`NODE_ENV=development`), and `false` turns it
	 * off there. It never takes effect in production, and only when the environment does not look like a deployed server (hosting platform variables,
	 * a public `AUTH_URL`) and the request's host is localhost. Asking for it with `true` on something that looks deployed refuses to start instead.
	 */
	readonly devBypass?: boolean;
	/**
	 * Login API path. Default `/api/cms/auth`, which the admin API route handles too, so no login route file is needed.
	 * The callback URL of an OAuth app is `<site>/<basePath>/callback/<provider id>`.
	 */
	readonly basePath?: string;
	/**
	 * What the host framework supplies. See {@link AuthHost}. Not needed in a Next.js app: `@monti-cms/nextjs` attaches its host to the instance it serves.
	 * Pass one only for code that runs outside such an integration.
	 */
	readonly host?: AuthHost;
}

const FORM = "application/x-www-form-urlencoded";
/** 8 hours, rolling. */
const SESSION_MAX_AGE = 28_800;

const pinnedUrl = (): string | undefined => process.env.AUTH_URL || process.env.NEXTAUTH_URL || undefined;

const isLoopbackHost = (host: string) => /^(localhost|127(\.\d{1,3}){3}|\[::1\])(:\d+)?$/i.test(host);

/**
 * The origin the browser used: `AUTH_URL` if it is set; else the forwarded or plain `Host` when the host is trusted; else the request URL's.
 * `undefined` when nothing says (a request that is not one).
 */
function originOf(headers: Pick<Headers, "get">, trustHost: boolean, requestUrl?: string): string | undefined {
	const pinned = pinnedUrl();
	if (pinned) return new URL(pinned).origin;
	const forwarded = trustHost ? headers.get("x-forwarded-host")?.split(",")[0]?.trim() : undefined;
	const host = forwarded || (trustHost || !requestUrl ? headers.get("host") : undefined);
	if (!host) return requestUrl ? new URL(requestUrl).origin : undefined;
	const forwardedProto = trustHost ? headers.get("x-forwarded-proto")?.split(",")[0]?.trim() : undefined;
	const protocol = forwardedProto || (requestUrl ? new URL(requestUrl).protocol.replace(":", "") : undefined);
	return `${protocol ?? (isLoopbackHost(host) ? "http" : "https")}://${host}`;
}

const messagesOf = (providers: readonly LoginProvider[]): MessageBundle => {
	const locales: Record<string, Record<string, string>> = { en: {} };
	for (const provider of providers) {
		for (const [locale, text] of Object.entries(provider.label)) {
			locales[locale] = { ...locales[locale], [`${provider.id}.label`]: text };
		}
	}
	return defineMessages("cms.auth", locales as { en: Record<string, string> } & Record<string, Record<string, string>>);
};

/** The admin ids of every provider, as canonical ids inside each provider. */
function adminSets(options: AuthOptions): Map<string, Set<string>> {
	const sets = new Map<string, Set<string>>(options.providers.map((provider) => [provider.id, new Set()]));
	const add = (provider: LoginProvider, entry: string | undefined) => {
		const raw = entry?.trim();
		if (!raw) return;
		const normalized = (provider.normalizeId ?? ((id: string) => id.trim() || null))(raw);
		if (normalized === null) {
			console.warn(`[cms-auth] Ignored the admin "${raw}": it is not an account id of ${provider.name}.`);
			return;
		}
		sets.get(provider.id)?.add(normalized);
	};
	for (const provider of options.providers) {
		for (const entry of provider.admins ?? []) {
			const prefixed = entry ? splitAccountId(entry.trim(), options.providers) : null;
			if (prefixed && prefixed.providerId !== provider.id) {
				throw new Error(
					`[cms-auth] The admin "${entry}" is listed on the ${provider.id} provider but belongs to ${prefixed.providerId}.`,
				);
			}
			add(provider, prefixed ? prefixed.id : entry);
		}
	}
	for (const entry of options.admins ?? []) {
		if (!entry?.trim()) continue;
		const split = splitAccountId(entry.trim(), options.providers);
		if (!split) {
			const known = options.providers.map((provider) => `${provider.id}:<id>`).join(", ");
			throw new Error(`[cms-auth] The admin "${entry}" must be a qualified account id (${known}).`);
		}
		const provider = options.providers.find((candidate) => candidate.id === split.providerId);
		if (provider) add(provider, split.id);
	}
	return sets;
}

/**
 * Admin login on standard `Request` and `Response`, over Auth.js core (`@auth/core`). The ways to log in are providers (`github()` from
 * `@monti-cms/auth/github`); the session is a signed cookie (a JWT), so nothing is stored for it. Used as `auth` in `defineConfig` (`monti.config.ts`).
 *
 * ```ts
 * auth: auth({ providers: [github()] })
 * ```
 *
 * The session-signing key is derived from the config's one secret (`MONTI_SECRET`), so there is no separate secret to set. Changing the secret signs everyone out;
 * the values stored encrypted keep working through `previousSecrets`.
 */
export function auth(options: AuthOptions): AuthAdapter {
	const { providers } = options;
	if (providers.length === 0) throw new Error("[cms-auth] auth() needs at least one provider.");
	const ids = new Set<string>();
	for (const provider of providers) {
		if (!/^[a-z][a-z0-9-]*$/.test(provider.id))
			throw new Error(`[cms-auth] "${provider.id}" is not a valid provider id.`);
		if (ids.has(provider.id)) throw new Error(`[cms-auth] Two providers have the id "${provider.id}".`);
		ids.add(provider.id);
	}
	const requireConfigured = () => {
		for (const provider of providers) provider.requireConfigured?.();
	};

	return {
		name: "auth",
		create: ({ site, loginPath, trustHost, secrets, storage, host: attachedHost }): CmsAuth => {
			// An explicit host wins; else the one the framework integration attaches to the instance.
			const host: AuthHost = options.host ?? attachedHost;
			assertDevBypassSafe(options.devBypass);
			if (!secrets.available) {
				throw new Error(
					"[cms-auth] `MONTI_SECRET` is empty, so login sessions cannot be signed; set it (any long random value, for example `openssl rand -base64 32`) in .env.local, or pass `defineConfig({ secret })`",
				);
			}
			// A server that requires login fails here, naming what is missing; one on the development bypass fails only when a sign-in is attempted.
			if (!isDevAuthBypassEnabled(options.devBypass)) requireConfigured();
			const t = site.createTranslator(messagesOf(providers));
			if (!trustHost && process.env.NODE_ENV === "production" && !pinnedUrl()) {
				console.warn(
					"[cms-auth] The host is not trusted, so login will fail with an UntrustedHost error. Behind a proxy or on a platform such as Vercel, " +
						"set `trustHost: true` in the config or AUTH_TRUST_HOST=true; or set AUTH_URL to the site's public URL.",
				);
			}
			const basePath = (options.basePath ?? CMS_AUTH_BASE_PATH).replace(/\/$/, "");
			const admins = adminSets(options);
			if (![...admins.values()].some((ids) => ids.size > 0) && !isDevAuthBypassEnabled(options.devBypass)) {
				console.warn(
					"[cms-auth] No admin is set, so nobody can log in. Set MONTI_ADMIN_GITHUB_ID (your numeric GitHub id) or pass `admins` to the provider or to auth().",
				);
			}
			const providerOf = (id: string | undefined) => providers.find((provider) => provider.id === id);
			const authjsProviders = providers.map((provider) => provider.setup({ storage, trustHost }));
			const authjsConfigProviders = authjsProviders as unknown as AuthConfig["providers"];
			const isCredentials = new Map(
				providers.map((provider, index) => {
					return [provider.id, authjsProviders[index]?.type === "credentials"] as const;
				}),
			);

			const config: AuthConfig = {
				// Auth.js matches the path of the request the browser sent, which includes the Next `basePath` (`CmsAuth.basePath` is the in-app path).
				basePath: withBasePath(basePath),
				// Derived from the one secret (HKDF, purpose "session"), so it differs from every key the plugins encrypt with.
				secret: secrets.deriveKey("session").toString("base64url"),
				providers: authjsConfigProviders,
				session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
				trustHost: trustHost || Boolean(pinnedUrl()),
				pages: { signIn: loginPath, error: loginPath },
				callbacks: {
					// A provider can refuse an account (no id, a disabled user).
					signIn: ({ user, account, profile }) =>
						Boolean(account && providerOf(account.provider)?.account({ user, account, profile })),
					jwt: ({ token, user, account, profile }) => {
						if (account) {
							const provider = providerOf(account.provider);
							const resolved = provider?.account({ user, account, profile });
							if (provider && resolved) {
								token.accountId = qualifyAccountId(provider, resolved.id);
								token.name = resolved.name ?? null;
							}
						}
						return token;
					},
					session: ({ session, token }) => {
						if (typeof token?.accountId !== "string") return session;
						const accountId = token.accountId;
						return {
							...session,
							user: {
								...session.user,
								id: accountId,
								accountId,
								...(typeof token.name === "string" ? { name: token.name } : {}),
							},
						};
					},
				},
			};
			// Server-side sign-in and sign-out post from here, not from a form of Auth.js, so they carry no CSRF token. The core's routes check the
			// request's origin before calling them. Requests from the network never use this config.
			const internalConfig: AuthConfig = { ...config, skipCSRFCheck };

			/** The request as the browser sent it: with `AUTH_URL`, or the forwarded host of a trusted proxy, as the origin. */
			const normalize = (request: Request): Request => {
				const origin = originOf(request.headers, config.trustHost === true, request.url);
				if (!origin) return request;
				const url = new URL(request.url);
				if (url.origin === origin) return request;
				return new Request(new URL(`${url.pathname}${url.search}`, origin), request);
			};
			const handle = (request: Request) => {
				requireConfigured();
				return Auth(normalize(request), config);
			};

			const headersOf = async (request: Request | undefined) =>
				request?.headers ?? (await host.requestHeaders?.()) ?? null;
			/** A request Auth.js answers, built from the headers of the browser's request. */
			const internalRequest = (
				path: string,
				headers: Pick<Headers, "get">,
				init: RequestInit = {},
				requestUrl?: string,
			): Request | null => {
				const origin = originOf(headers, config.trustHost === true, requestUrl);
				if (!origin) return null;
				const cookie = headers.get("cookie");
				return new Request(`${origin}${config.basePath}${path}`, {
					...init,
					headers: { ...(cookie ? { cookie } : {}), ...(init.method === "POST" ? { "content-type": FORM } : {}) },
				});
			};

			const flow = async (path: string, request: Request | undefined, redirectTo: string | undefined) => {
				const headers = await headersOf(request);
				const internal =
					headers &&
					internalRequest(
						path,
						headers,
						{ method: "POST", body: new URLSearchParams({ callbackUrl: redirectTo ?? "/" }) },
						request?.url,
					);
				if (!internal) throw new Error("[cms-auth] Signing in or out needs the request it is for.");
				return Auth(internal, internalConfig);
			};

			const defaultProvider = providers[0]?.id ?? "";
			return {
				basePath,
				handlers: { GET: handle, POST: handle },
				session: async (request) => {
					const headers = await headersOf(request);
					if (!headers?.get("cookie")) return null;
					const internal = internalRequest("/session", headers, {}, request?.url);
					if (!internal) return null;
					const response = await Auth(internal, config);
					if (!response.ok) return null;
					const session = (await response.json()) as {
						user?: { id?: string; accountId?: string; name?: string };
					} | null;
					const user = session?.user;
					if (!user?.accountId) return null;
					return { user: { id: user.id, accountId: user.accountId, ...(user.name ? { name: user.name } : {}) } };
				},
				providers: providers.map((provider) => ({
					id: provider.id,
					name: provider.name,
					get label() {
						return t(`${provider.id}.label`);
					},
					...(provider.icon ? { icon: provider.icon } : {}),
				})),
				signIn: async (providerId = defaultProvider, signInOptions) => {
					if (!providerOf(providerId)) throw new Error(`[cms-auth] Unknown sign-in method "${providerId}".`);
					requireConfigured();
					if (isCredentials.get(providerId)) {
						throw new Error(
							`[cms-auth] "${providerId}" is a credentials provider, which needs a form on the login page. Not supported yet.`,
						);
					}
					return flow(`/signin/${providerId}`, signInOptions?.request, signInOptions?.redirectTo);
				},
				signOut: async (signOutOptions) => flow("/signout", signOutOptions?.request, signOutOptions?.redirectTo),
				isAdmin: (accountId) => {
					const split = splitAccountId(String(accountId ?? "").trim(), providers);
					const provider = providerOf(split?.providerId);
					if (!split || !provider) return false;
					const normalized = (provider.normalizeId ?? ((id: string) => id.trim() || null))(split.id);
					return normalized !== null && Boolean(admins.get(provider.id)?.has(normalized));
				},
				get devBypass() {
					return isDevAuthBypassEnabled(options.devBypass);
				},
				devUserId: firstAdmin(providers, admins) ?? "local-dev",
				...(host.requestHeaders ? { requestHeaders: host.requestHeaders } : {}),
				...(host.rethrow ? { rethrow: host.rethrow } : {}),
			};
		},
	};
}

/** The first admin of the first provider that has one, qualified: who the development bypass acts as. */
function firstAdmin(
	providers: readonly LoginProvider[],
	admins: ReadonlyMap<string, ReadonlySet<string>>,
): string | undefined {
	for (const provider of providers) {
		const [first] = admins.get(provider.id) ?? [];
		if (first !== undefined) return qualifyAccountId(provider, first);
	}
	return undefined;
}
