type Env = Readonly<Record<string, string | undefined>>;
/** The variable that says the environment is a known proxy platform (`VERCEL`, ...), or `undefined`. */
export declare function detectProxyPlatform(env?: Env): string | undefined;
/**
 * Whether the `Host` and `X-Forwarded-Host` request headers can be trusted: the server runs behind a proxy or platform (Vercel, nginx, a load balancer)
 * that sets them, so login callback URLs may be built from them and the same-origin check accepts `X-Forwarded-Host`.
 *
 * Order: the `trustHost` option of the config, then the `AUTH_TRUST_HOST` environment variable (`true`/`1` or `false`/`0`), then on when the environment
 * is a known proxy platform ({@link detectProxyPlatform}: `VERCEL`, `NETLIFY`, `CF_PAGES`, ...), then on in development and tests (where the host is
 * `localhost`), else off. Off means a client-supplied `X-Forwarded-Host` is ignored, so a server behind a proxy that is not detected must say it.
 */
export declare function resolveTrustHost(configured: boolean | undefined, env?: Env): boolean;
/** {@link resolveTrustHost} with the reason for the answer, for `monti doctor`. */
export declare function explainTrustHost(configured: boolean | undefined, env?: Env): {
    readonly trusted: boolean;
    readonly source: string;
};
export {};
