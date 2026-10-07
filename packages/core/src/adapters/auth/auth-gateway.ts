import type { AuthContext, CmsAuth } from "../../server/define";
import { isLoopbackRequest, productionLikeEnvironment } from "./dev-bypass";

export type { AuthContext } from "../../server/define";

export interface AuthGateway {
	verifyAdmin(): Promise<AuthContext>;
	/** Whether the development bypass applies to the current request (on in config, safe environment, request from this machine). */
	isDevBypassActive(): Promise<boolean>;
}

/** Headers of the request being handled, or `null` outside a request. */
export type RequestHeaders = () => Promise<Pick<Headers, "get"> | null>;

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
 * Whether the auth bypass, local development only, is on. Even if enabled in config, it is true only when `NODE_ENV=development`
 * and the environment does not look like a deployed server ({@link productionLikeEnvironment}).
 * Ignored otherwise (fail-closed). Whether a request may use it is decided per request by {@link CmsAuthGateway.isDevBypassActive}.
 */
export function isDevAuthBypassEnabled(
	enabled: boolean | undefined,
	env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
	return enabled === true && env.NODE_ENV === "development" && productionLikeEnvironment(env) === undefined;
}

/**
 * Refuses to build the login connection when the bypass is switched on in a development-mode process that looks deployed
 * (e.g. a staging server started with `NODE_ENV=development`), where it would open the CMS to everyone.
 * In any other mode the bypass is simply ignored, and says so.
 */
export function assertDevBypassSafe(
	enabled: boolean | undefined,
	env: Readonly<Record<string, string | undefined>> = process.env,
): void {
	if (enabled !== true) return;
	if (env.NODE_ENV !== "development") {
		console.warn(`[cms-auth] devBypass is ignored because NODE_ENV is "${env.NODE_ENV ?? ""}", not "development".`);
		return;
	}
	const reason = productionLikeEnvironment(env);
	if (reason) {
		throw new Error(
			`[cms-auth] Refusing to start with devBypass: NODE_ENV is "development" but this looks like a deployed server (${reason}). ` +
				"The bypass opens the CMS to everyone as an admin. Turn devBypass off (CMS_DEV_AUTH_BYPASS) on this server.",
		);
	}
}

let devBypassWarned = false;
let devBypassSkippedWarned = false;

/** Authentication for the admin API and UI. The login method is set by `auth` in the server config. */
export class CmsAuthGateway implements AuthGateway {
	constructor(
		private readonly getAuth: () => CmsAuth,
		/** Where the headers of the request being handled come from. Default: the login connection's own (`CmsAuth.requestHeaders`), the host framework's. */
		private readonly requestHeaders: RequestHeaders = async () => (await this.getAuth().requestHeaders?.()) ?? null,
	) {}

	async isDevBypassActive(): Promise<boolean> {
		if (!this.getAuth().devBypass) return false;
		const headers = await this.requestHeaders();
		if (headers && isLoopbackRequest(headers)) {
			if (!devBypassWarned) {
				devBypassWarned = true;
				console.warn(
					"[cms-auth] DEV AUTH BYPASS is on: every request from this machine is treated as the first admin without logging in. Development only.",
				);
			}
			return true;
		}
		if (!devBypassSkippedWarned) {
			devBypassSkippedWarned = true;
			console.warn(
				`[cms-auth] DEV AUTH BYPASS skipped: the request does not come from localhost (host: ${headers?.get("host") ?? "unknown"}). Signing in is required.`,
			);
		}
		return false;
	}

	async verifyAdmin(): Promise<AuthContext> {
		const cmsAuth = this.getAuth();
		if (await this.isDevBypassActive()) {
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
