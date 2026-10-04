import { withBasePath } from "../../core/base-path";
import { createActiveTranslator } from "../../i18n/active";
import { type AuthAdapter, CMS_AUTH_BASE_PATH, type CmsAuth } from "../../server/define";
import type { createGithubNextAuth } from "./auth-config";
import { isAllowedAdminId, isDevAuthBypassEnabled } from "./auth-gateway";
import { authMessages } from "./messages";

/** The UI locale is picked when text is read. Used instead of `i18n`, which reads the site config, so that `cms.server.ts` does not pull in the config. */
const t = createActiveTranslator(authMessages);

export interface GithubAuthOptions {
	readonly clientId: string | undefined;
	readonly clientSecret: string | undefined;
	/** Admin GitHub numeric IDs. If empty, nobody is an admin. */
	readonly adminIds: readonly (string | undefined)[];
	/** Treats the user as admin without login in local development. Only takes effect when `NODE_ENV=development`. */
	readonly devBypass?: boolean;
	/**
	 * Login API path. Default `/api/cms/auth`, which the admin API route handles too, so no login route file is needed.
	 * The callback URL of the GitHub OAuth app is `<site>/<basePath>/callback/github`. To keep using `/api/auth` as before,
	 * set `basePath: "/api/auth"` and export `handlers` from `@monti-cms/core/runtime` in `app/api/auth/[...nextauth]/route.ts`.
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
 * GitHub OAuth (NextAuth) admin login. NextAuth is loaded the first time login is used
 * (so code that only uses the store, and command-line tools, do not read next-auth).
 */
export function githubAuth(options: GithubAuthOptions): AuthAdapter {
	return {
		name: "github",
		create: ({ loginPath }): CmsAuth => {
			const basePath = (options.basePath ?? CMS_AUTH_BASE_PATH).replace(/\/$/, "");
			let nextAuth: Promise<NextAuthResult> | undefined;
			const load = () => {
				nextAuth ??= import("./auth-config").then((module) =>
					module.createGithubNextAuth({
						...options,
						// NextAuth matches paths against the request URL the browser sees, so it includes the Next `basePath` (`CmsAuth.basePath` is the in-app path).
						basePath: withBasePath(basePath),
						signInPage: loginPath,
					}),
				);
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
					return { user: { id: session.user?.id, accountId: session.user?.githubId } };
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
			};
		},
	};
}
