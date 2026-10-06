type Env = Readonly<Record<string, string | undefined>>;

const parseFlag = (value: string | undefined): boolean | undefined => {
	const normalized = value?.trim().toLowerCase();
	if (normalized === "true" || normalized === "1") return true;
	if (normalized === "false" || normalized === "0") return false;
	return undefined;
};

/**
 * Whether the `Host` and `X-Forwarded-Host` request headers can be trusted: the server runs behind a proxy or platform (Vercel, nginx, a load balancer)
 * that sets them, so login callback URLs may be built from them and the same-origin check accepts `X-Forwarded-Host`.
 *
 * Order: the `trustHost` option of the server config, then the `AUTH_TRUST_HOST` environment variable (`true`/`1` or `false`/`0`),
 * then off in production and on in development and tests (where the host is `localhost`). Off means a client-supplied
 * `X-Forwarded-Host` is ignored.
 */
export function resolveTrustHost(configured: boolean | undefined, env: Env = process.env): boolean {
	if (configured !== undefined) return configured;
	return parseFlag(env.AUTH_TRUST_HOST) ?? env.NODE_ENV !== "production";
}
