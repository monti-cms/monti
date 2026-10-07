import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import type { AuthAdapter } from "@monti-cms/core/server";
import { nextHost } from "./host";

export interface GithubAuthOptions {
	readonly clientId: string | undefined;
	readonly clientSecret: string | undefined;
	/** Admin GitHub numeric IDs. If empty, nobody is an admin. */
	readonly adminIds: readonly (string | undefined)[];
	/** See `devBypass` of `auth()` in `@monti-cms/auth`. */
	readonly devBypass?: boolean;
	/** See `basePath` of `auth()` in `@monti-cms/auth`. */
	readonly basePath?: string;
	/** See `secret` of `auth()` in `@monti-cms/auth`. */
	readonly secret?: string;
}

/**
 * GitHub login on `@monti-cms/auth`, with the same options as before.
 *
 * @deprecated Use `auth({ providers: [github({ ..., admins })], host: nextHost })` (`auth` from `@monti-cms/auth`, `github` from `@monti-cms/auth/github`):
 * it takes more than one login method. Existing sessions end when you move from NextAuth, and the people logging in sign in once more.
 */
export function githubAuth(options: GithubAuthOptions): AuthAdapter {
	return auth({
		providers: [github({ clientId: options.clientId, clientSecret: options.clientSecret, admins: options.adminIds })],
		...(options.devBypass !== undefined ? { devBypass: options.devBypass } : {}),
		...(options.basePath !== undefined ? { basePath: options.basePath } : {}),
		...(options.secret !== undefined ? { secret: options.secret } : {}),
		host: nextHost,
	});
}
