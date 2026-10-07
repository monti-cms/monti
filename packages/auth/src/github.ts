import GitHub from "@auth/core/providers/github";
import { githubLabel } from "./messages";
import type { LoginProvider } from "./provider";

/** The environment variables `github()` reads when an option is not given. Nothing else is looked at. */
export const GITHUB_ENV = {
	clientId: "AUTH_GITHUB_ID",
	clientSecret: "AUTH_GITHUB_SECRET",
	admin: "MONTI_ADMIN_GITHUB_ID",
} as const;

export interface GithubOptions {
	/** Client id of the GitHub OAuth app. If unset, the `AUTH_GITHUB_ID` environment variable. */
	readonly clientId?: string | undefined;
	/** Client secret of the GitHub OAuth app. If unset, the `AUTH_GITHUB_SECRET` environment variable. */
	readonly clientSecret?: string | undefined;
	/**
	 * Admins by numeric GitHub id (`"12345678"`, or `"github:12345678"`). Logins are not accepted: a login can be renamed and then taken by someone else.
	 * If unset, the `MONTI_ADMIN_GITHUB_ID` environment variable (one id, or several separated by commas). Unset entries are skipped. With none, nobody is an admin.
	 */
	readonly admins?: readonly (string | undefined)[];
}

const fromEnv = (name: string): string | undefined => process.env[name]?.trim() || undefined;

/** The admins of the option, else of `MONTI_ADMIN_GITHUB_ID` (comma separated). */
const adminsOf = (options: GithubOptions): readonly (string | undefined)[] =>
	options.admins ??
	(fromEnv(GITHUB_ENV.admin)
		?.split(",")
		.map((id) => id.trim())
		.filter(Boolean) ||
		[]);

/** The GitHub mark in a mid grey that reads on light and dark backgrounds (an `<img>` cannot follow the text color). */
const GITHUB_ICON = `data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#8b949e"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
)}`;

/**
 * Log in with GitHub. It works with no arguments: the OAuth app comes from `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`, the admin from `MONTI_ADMIN_GITHUB_ID`,
 * and a value passed here wins. A missing id or secret is an error that names the variable. The account id is the numeric GitHub id, so `github:12345678`
 * is the same person after a rename. The callback URL of the OAuth app is `<site>/api/cms/auth/callback/github`.
 */
export function github(options: GithubOptions = {}): LoginProvider {
	const clientId = () => options.clientId || fromEnv(GITHUB_ENV.clientId);
	const clientSecret = () => options.clientSecret || fromEnv(GITHUB_ENV.clientSecret);
	return {
		id: "github",
		name: "GitHub",
		label: githubLabel,
		icon: GITHUB_ICON,
		get admins() {
			return adminsOf(options);
		},
		requireConfigured: () => {
			if (!clientId()) {
				throw new Error(
					`[cms-auth] The GitHub client id is not set. Set ${GITHUB_ENV.clientId} (the OAuth app's client id, for example in .env.local) or pass github({ clientId }).`,
				);
			}
			if (!clientSecret()) {
				throw new Error(
					`[cms-auth] The GitHub client secret is not set. Set ${GITHUB_ENV.clientSecret} (the OAuth app's client secret, for example in .env.local) or pass github({ clientSecret }).`,
				);
			}
		},
		setup: () =>
			GitHub({
				clientId: clientId(),
				clientSecret: clientSecret(),
				profile: (profile) => ({
					id: String(profile.id),
					name: profile.name ?? profile.login,
					email: profile.email,
					image: profile.avatar_url,
				}),
			}),
		account: ({ user, account, profile }) => {
			const id = profile?.id != null ? String(profile.id) : account.providerAccountId;
			return id ? { id, ...(user.name ? { name: user.name } : {}) } : null;
		},
		// Numeric ids without leading zeros; anything else (a login) never matches.
		normalizeId: (id) => (/^\d+$/.test(id.trim()) ? BigInt(id.trim()).toString() : null),
	};
}
