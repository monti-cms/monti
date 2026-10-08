type Env = Readonly<Record<string, string | undefined>>;

const parseFlag = (value: string | undefined): boolean | undefined => {
	const normalized = value?.trim().toLowerCase();
	if (normalized === "true" || normalized === "1") return true;
	if (normalized === "false" || normalized === "0") return false;
	return undefined;
};

/**
 * Environment variables of hosting platforms whose edge sets `Host` and `X-Forwarded-Host` itself (and drops what a client sent), so the host can be trusted
 * there. Not every hosted environment is on the list: a server behind a proxy you run yourself (nginx, a load balancer) is not detected and needs
 * `trustHost: true` or `AUTH_TRUST_HOST=true`.
 */
const PROXY_PLATFORM_VARIABLES = [
	"VERCEL",
	"NETLIFY",
	"CF_PAGES",
	"RENDER",
	"RAILWAY_ENVIRONMENT",
	"FLY_APP_NAME",
	"K_SERVICE",
] as const;

/** The variable that says the environment is a known proxy platform (`VERCEL`, ...), or `undefined`. */
export function detectProxyPlatform(env: Env = process.env): string | undefined {
	return PROXY_PLATFORM_VARIABLES.find((name) => Boolean(env[name]));
}

/**
 * Whether the `Host` and `X-Forwarded-Host` request headers can be trusted: the server runs behind a proxy or platform (Vercel, nginx, a load balancer)
 * that sets them, so login callback URLs may be built from them and the same-origin check accepts `X-Forwarded-Host`.
 *
 * Order: the `trustHost` option of the config, then the `AUTH_TRUST_HOST` environment variable (`true`/`1` or `false`/`0`), then on when the environment
 * is a known proxy platform ({@link detectProxyPlatform}: `VERCEL`, `NETLIFY`, `CF_PAGES`, ...), then on in development and tests (where the host is
 * `localhost`), else off. Off means a client-supplied `X-Forwarded-Host` is ignored, so a server behind a proxy that is not detected must say it.
 */
export function resolveTrustHost(configured: boolean | undefined, env: Env = process.env): boolean {
	return explainTrustHost(configured, env).trusted;
}

/** {@link resolveTrustHost} with the reason for the answer, for `monti doctor`. */
export function explainTrustHost(
	configured: boolean | undefined,
	env: Env = process.env,
): { readonly trusted: boolean; readonly source: string } {
	if (configured !== undefined) return { trusted: configured, source: "set in monti.config.ts (trustHost)" };
	const fromEnv = parseFlag(env.AUTH_TRUST_HOST);
	if (fromEnv !== undefined) return { trusted: fromEnv, source: "from env AUTH_TRUST_HOST" };
	const platform = detectProxyPlatform(env);
	if (platform !== undefined) return { trusted: true, source: `auto-detected (hosting platform: ${platform} is set)` };
	if (env.NODE_ENV !== "production") {
		return { trusted: true, source: `auto-detected (NODE_ENV is "${env.NODE_ENV ?? ""}", not production)` };
	}
	return { trusted: false, source: "auto-detected (production, and no known hosting platform variable is set)" };
}
