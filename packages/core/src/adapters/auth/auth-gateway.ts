import type { AuthContext, CmsAuth } from "../../server/define";

export type { AuthContext } from "../../server/define";

export interface AuthGateway {
	verifyAdmin(): Promise<AuthContext>;
}

export class AuthError extends Error {
	constructor(
		public readonly code: "unauthorized" | "forbidden",
		message: string,
	) {
		super(message);
		this.name = "AuthError";
	}
}

/** Whether a GitHub numeric ID is in the admin list. Ignores leading zeros and rejects non-numeric values. */
export function isAllowedAdminId(
	githubId: string | undefined | null,
	adminIds: readonly (string | undefined)[],
): boolean {
	const target = String(githubId ?? "").trim();
	if (!/^\d+$/.test(target)) return false;
	const normalized = BigInt(target).toString();
	return adminIds.some((id) => {
		const expected = id?.trim() ?? "";
		return /^\d+$/.test(expected) && BigInt(expected).toString() === normalized;
	});
}

/**
 * Whether the auth bypass, local development only, is on. Even if enabled in config, it is true only when `NODE_ENV=development`.
 * Ignored in production even if switched on (fail-closed).
 */
export function isDevAuthBypassEnabled(enabled: boolean | undefined): boolean {
	return enabled === true && process.env.NODE_ENV === "development";
}

let devBypassWarned = false;

/** Authentication for the admin API and UI. The login method is set by `auth` in the server config. */
export class CmsAuthGateway implements AuthGateway {
	constructor(private readonly getAuth: () => CmsAuth) {}

	async verifyAdmin(): Promise<AuthContext> {
		const cmsAuth = this.getAuth();
		if (cmsAuth.devBypass) {
			if (!devBypassWarned) {
				devBypassWarned = true;
				console.warn("[cms-auth] DEV AUTH BYPASS enabled (development only, never use in production)");
			}
			return { userId: cmsAuth.devUserId, accountId: cmsAuth.devUserId, isAdmin: true };
		}

		const session = await cmsAuth.session();
		if (!session?.user?.accountId) {
			throw new AuthError("unauthorized", "Authentication required");
		}

		const accountId = String(session.user.accountId);
		if (!cmsAuth.isAdmin(accountId)) {
			throw new AuthError("forbidden", "Forbidden: not an authorized admin");
		}

		return { userId: session.user.id || accountId, accountId, isAdmin: true };
	}
}
