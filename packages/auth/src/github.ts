import GitHub from "@auth/core/providers/github";
import { envValue, problemText, WHERE_TO_SET_ENV } from "@monti-cms/core";
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

const fromEnv = (name: string): string | undefined => envValue(process.env, name);

/** The admins of the option, else of `MONTI_ADMIN_GITHUB_ID` (comma separated). */
const adminsOf = (options: GithubOptions): readonly (string | undefined)[] =>
	options.admins ??
	(fromEnv(GITHUB_ENV.admin)
		?.split(",")
		.map((id) => id.trim())
		.filter(Boolean) ||
		[]);

/** How to get the two values. */
const OAUTH_APP_FIX =
	"create a GitHub OAuth app (https://github.com/settings/developers, OAuth Apps, New OAuth App) whose callback URL is <your site>/api/monti/auth/callback/github (`monti doctor` prints it), then copy its Client ID into AUTH_GITHUB_ID and a new client secret into AUTH_GITHUB_SECRET";

/**
 * Log in with GitHub. It works with no arguments: the OAuth app comes from `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`, the admin from `MONTI_ADMIN_GITHUB_ID`,
 * and a value passed here wins. A missing id or secret is an error that names the variable. The account id is the numeric GitHub id, so `github:12345678`
 * is the same person after a rename. The callback URL of the OAuth app is `<site>/api/monti/auth/callback/github`.
 */
export function github(options: GithubOptions = {}): LoginProvider {
	const clientId = () => options.clientId || fromEnv(GITHUB_ENV.clientId);
	const clientSecret = () => options.clientSecret || fromEnv(GITHUB_ENV.clientSecret);

	return {
		id: "github",
		name: "GitHub",
		label: githubLabel,
		icon: "logo--github",
		usesCallbackUrl: true,
		provenance: (env) => {
			const part = (label: string, given: string | undefined, name: string) =>
				given
					? `${label} set in monti.config.ts`
					: envValue(env, name)
						? `${label} from env ${name}`
						: `${label}: env ${name} is not set`;
			const admins = options.admins
				? "admins set in monti.config.ts"
				: env[GITHUB_ENV.admin]?.trim()
					? `admins from env ${GITHUB_ENV.admin}`
					: `no admin: env ${GITHUB_ENV.admin} is not set`;
			return `${part("client id", options.clientId, GITHUB_ENV.clientId)}, ${part("client secret", options.clientSecret, GITHUB_ENV.clientSecret)}, ${admins}`;
		},
		adminSource: {
			env: GITHUB_ENV.admin,
			findId: 'open https://api.github.com/users/<your-github-login> in a browser and copy the number after "id"',
		},
		get admins() {
			return adminsOf(options);
		},
		requireConfigured: () => {
			if (!clientId()) {
				throw new Error(
					problemText({
						what: `${GITHUB_ENV.clientId} is not set, so GitHub login cannot start`,
						where: `${WHERE_TO_SET_ENV}, or \`github({ clientId })\` in monti.config.ts`,
						fix: `${OAUTH_APP_FIX}; \`monti doctor\` checks the rest. Under \`next dev\` you are signed in without GitHub`,
					}),
				);
			}
			if (!clientSecret()) {
				throw new Error(
					problemText({
						what: `${GITHUB_ENV.clientSecret} is not set, so GitHub login cannot start`,
						where: `${WHERE_TO_SET_ENV}, or \`github({ clientSecret })\` in monti.config.ts`,
						fix: `${OAUTH_APP_FIX}; \`monti doctor\` checks the rest. Under \`next dev\` you are signed in without GitHub`,
					}),
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
