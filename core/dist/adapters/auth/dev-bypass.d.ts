/**
 * Guards for the development auth bypass (`devBypass`), which opens the whole CMS to everyone as the first admin.
 * `NODE_ENV=development` alone is not enough: staging servers are often started that way. The bypass also needs an environment
 * that does not look deployed, and a request that comes from the machine itself.
 */
type Env = Readonly<Record<string, string | undefined>>;
/** Whether a host name (no port) is this machine: `localhost`, `*.localhost`, `127.0.0.0/8` or `::1`. */
export declare function isLoopbackHostname(hostname: string): boolean;
/**
 * Why this environment looks like a deployed server, or `undefined` if it looks like a developer's machine.
 * Checks the hosting platforms' environment variables and a public `AUTH_URL`.
 */
export declare function productionLikeEnvironment(env?: Env): string | undefined;
/**
 * Whether a request comes from this machine: the `Host` (and `X-Forwarded-Host`, if a proxy added one that differs) is a loopback name,
 * and every address in `X-Forwarded-For` (Next fills it with the socket's address when there is no proxy) is a loopback address.
 * A client can send these headers itself, so this only narrows the bypass; it is not an authentication check.
 */
export declare function isLoopbackRequest(headers: Pick<Headers, "get">): boolean;
export {};
