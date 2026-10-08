import { type AuthAdapter, CMS_AUTH_BASE_PATH, type CmsAuth } from "../../server/define";
import { isDevAuthBypassEnabled } from "./auth-gateway";
import { productionLikeEnvironment } from "./dev-bypass";

/**
 * The login of a config that names none (`auth` left out of `defineConfig`). Nobody can sign in: under `next dev` the development bypass lets the
 * machine's own requests into the admin, everywhere else the admin refuses everyone and the login screen says that no login is configured.
 */
export function noLogin(): AuthAdapter {
	const unavailable = async () => Response.json({ error: "no_login_configured" }, { status: 404 });
	return {
		name: "none",
		decisions: (env) => {
			const bypassOn = isDevAuthBypassEnabled(undefined, env);
			const deployed = productionLikeEnvironment(env);
			return [
				{ topic: "Login", value: "none", source: "`auth` is not set in monti.config.ts" },
				{
					topic: "Dev login bypass",
					value: bypassOn ? "on (requests from this machine are the admin, no login)" : "off",
					source: bypassOn
						? 'auto-detected (NODE_ENV is "development" and no hosting platform variable is set)'
						: env.NODE_ENV !== "development"
							? `auto-detected (NODE_ENV is "${env.NODE_ENV ?? ""}", not "development")`
							: `auto-detected (looks deployed: ${deployed})`,
				},
			];
		},
		create: ({ host }): CmsAuth => ({
			basePath: CMS_AUTH_BASE_PATH,
			handlers: { GET: unavailable, POST: unavailable },
			session: async () => null,
			providers: [],
			signIn: unavailable,
			signOut: unavailable,
			isAdmin: () => false,
			get devBypass() {
				return isDevAuthBypassEnabled(undefined);
			},
			devUserId: "local-dev",
			...(host.requestHeaders ? { requestHeaders: host.requestHeaders } : {}),
			...(host.rethrow ? { rethrow: host.rethrow } : {}),
		}),
	};
}
