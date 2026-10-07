import {
	assertDevBypassSafe,
	isAllowedAdminId,
	isDevAuthBypassEnabled,
	withBasePath,
} from "@monti-cms/core/adapters/auth";
import { type AuthAdapter, CMS_AUTH_BASE_PATH, type CmsAuth } from "@monti-cms/core/server";
import type { createGithubNextAuth } from "./auth-config";
import { authMessages } from "./messages";

export interface GithubAuthOptions {
	readonly clientId: string | undefined;
	readonly clientSecret: string | undefined;
	/** Admin GitHub numeric IDs. If empty, nobody is an admin. */
	readonly adminIds: readonly (string | undefined)[];
	/**
	 * Treats requests from this machine as admin without login, in local development. Only takes effect when `NODE_ENV=development`,
	 * the environment does not look like a deployed server (hosting platform variables, a public `AUTH_URL`) and the request's host is localhost.
	 * With `NODE_ENV=development` on something that looks deployed, it refuses to start instead.
	 */
	readonly devBypass?: boolean;
	/**
	 * Login API path. Default `/api/cms/auth`, which the admin API route handles too, so no login route file is needed.
	 * The callback URL of the GitHub OAuth app is `<site>/<basePath>/callback/github`. To keep using `/api/auth` as before,
	 * set `basePath: "/api/auth"` and export `GET` and `POST` from `cms.authHandlers` in `app/api/auth/[...nextauth]/route.ts`.
	 */
	readonly basePath?: string;
	/**
	 * Login session signing value (NextAuth `secret`). Kept separate from the stored-value encryption key (server config `secret`): changing this only signs users out,
	 * while changing the encryption key means re-entering the stored AI service keys. If unset, NextAuth reads the `AUTH_SECRET` environment variable.
	 */
	readonly secret?: string;
}

type NextAuthResult = ReturnType<typeof createGithubNextAuth>;

/**
 * Headers of the request being handled, or `null` outside a request (a command-line tool, or a module loaded at build time).
 * Read from `next/headers` when asked, so the module is not loaded by code that never handles a request.
 */
const requestHeaders = async (): Promise<Pick<Headers, "get"> | null> => {
	try {
		const { headers } = await import("next/headers");
		return await headers();
	} catch {
		return null;
	}
};

/**
 * GitHub OAuth (NextAuth) admin login. NextAuth is loaded the first time login is used
 * (so code that only uses the store, and command-line tools, do not read next-auth).
 */
export function githubAuth(options: GithubAuthOptions): AuthAdapter {
	return {
		name: "github",
		create: ({ site, loginPath, trustHost }): CmsAuth => {
			assertDevBypassSafe(options.devBypass);
			// The login texts follow the admin language of the instance's site.
			const t = site.createTranslator(authMessages);
			if (!trustHost && process.env.NODE_ENV === "production" && !(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL)) {
				console.warn(
					"[cms-auth] The host is not trusted, so login will fail with an UntrustedHost error. Behind a proxy or on a platform such as Vercel, " +
						"set `trustHost: true` in the server config or AUTH_TRUST_HOST=true; or set AUTH_URL to the site's public URL.",
				);
			}
			const basePath = (options.basePath ?? CMS_AUTH_BASE_PATH).replace(/\/$/, "");
			let nextAuth: Promise<NextAuthResult> | undefined;
			/** `unstable_rethrow` of `next/navigation`, once login has been used (a redirect can only be thrown after that). */
			let rethrowNextSignal: ((error: unknown) => void) | undefined;
			const load = () => {
				nextAuth ??= Promise.all([import("./auth-config"), import("next/navigation")]).then(([module, navigation]) => {
					rethrowNextSignal = navigation.unstable_rethrow;
					return module.createGithubNextAuth({
						...options,
						// NextAuth matches paths against the request URL the browser sees, so it includes the Next `basePath` (`CmsAuth.basePath` is the in-app path).
						basePath: withBasePath(basePath),
						signInPage: loginPath,
						trustHost,
					});
				});
				return nextAuth;
			};
			return {
				basePath,
				handlers: {
					GET: async (request) =>
						(await load()).handlers.GET(request as Parameters<NextAuthResult["handlers"]["GET"]>[0]),
					POST: async (request) =>
						(await load()).handlers.POST(request as Parameters<NextAuthResult["handlers"]["POST"]>[0]),
				},
				session: async () => {
					const session = await (await load()).auth();
					if (!session) return null;
					return {
						user: {
							id: session.user?.id,
							accountId: session.user?.githubId,
							...(session.user?.name ? { name: session.user.name } : {}),
						},
					};
				},
				providers: [
					{
						id: "github",
						name: "GitHub",
						get label() {
							return t("github.label");
						},
					},
				],
				signIn: async (provider = "github", signInOptions) => (await load()).signIn(provider, signInOptions),
				signOut: async (signOutOptions) => (await load()).signOut(signOutOptions),
				isAdmin: (userId) => isAllowedAdminId(userId, options.adminIds),
				get devBypass() {
					return isDevAuthBypassEnabled(options.devBypass);
				},
				devUserId: options.adminIds.find((id) => id?.trim())?.trim() || "local-dev",
				requestHeaders,
				// NextAuth sends the browser away (to the provider, back to the admin) by throwing a Next redirect; it must reach Next.
				rethrow: (error) => rethrowNextSignal?.(error),
			};
		},
	};
}
