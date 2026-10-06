/**
 * Guards for the development auth bypass (`devBypass`), which opens the whole CMS to everyone as the first admin.
 * `NODE_ENV=development` alone is not enough: staging servers are often started that way. The bypass also needs an environment
 * that does not look deployed, and a request that comes from the machine itself.
 */

type Env = Readonly<Record<string, string | undefined>>;

/** Environment variables that platforms set on their hosted servers. If one is present, the process is not a developer's machine. */
const HOSTED_ENVIRONMENT_VARIABLES = [
	"VERCEL",
	"NETLIFY",
	"CF_PAGES",
	"RENDER",
	"RAILWAY_ENVIRONMENT",
	"FLY_APP_NAME",
	"K_SERVICE",
	"AWS_EXECUTION_ENV",
	"AWS_LAMBDA_FUNCTION_NAME",
	"KUBERNETES_SERVICE_HOST",
	"DYNO",
] as const;

/** Whether a host name (no port) is this machine: `localhost`, `*.localhost`, `127.0.0.0/8` or `::1`. */
export function isLoopbackHostname(hostname: string): boolean {
	const name = hostname
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/^::ffff:/, "");
	return name === "localhost" || name.endsWith(".localhost") || name === "::1" || /^127(\.\d{1,3}){3}$/.test(name);
}

/** Host name part of a `Host`-style value (`example.com:3000`, `[::1]:3000`). */
function hostnameOf(host: string): string {
	const value = host.trim();
	if (value.startsWith("[")) return value.slice(0, value.indexOf("]") + 1);
	// A bare IPv6 address has several colons and no port.
	return value.split(":").length > 2 ? value : value.split(":")[0];
}

function isLoopbackUrl(value: string): boolean {
	try {
		return isLoopbackHostname(new URL(value).hostname);
	} catch {
		return false;
	}
}

/**
 * Why this environment looks like a deployed server, or `undefined` if it looks like a developer's machine.
 * Checks the hosting platforms' environment variables and a public `AUTH_URL`.
 */
export function productionLikeEnvironment(env: Env = process.env): string | undefined {
	for (const name of HOSTED_ENVIRONMENT_VARIABLES) {
		if (env[name]) return `${name} is set`;
	}
	const authUrl = env.AUTH_URL ?? env.NEXTAUTH_URL;
	if (authUrl && !isLoopbackUrl(authUrl)) return `AUTH_URL points to a public address (${authUrl})`;
	return undefined;
}

/**
 * Whether a request comes from this machine: the `Host` (and `X-Forwarded-Host`, if a proxy added one that differs) is a loopback name,
 * and every address in `X-Forwarded-For` (Next fills it with the socket's address when there is no proxy) is a loopback address.
 * A client can send these headers itself, so this only narrows the bypass; it is not an authentication check.
 */
export function isLoopbackRequest(headers: Pick<Headers, "get">): boolean {
	const host = headers.get("host");
	if (!host || !isLoopbackHostname(hostnameOf(host))) return false;
	const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0];
	if (forwardedHost && !isLoopbackHostname(hostnameOf(forwardedHost))) return false;
	const forwardedFor = headers.get("x-forwarded-for");
	if (forwardedFor) {
		return forwardedFor.split(",").every((address) => isLoopbackHostname(address));
	}
	return true;
}
