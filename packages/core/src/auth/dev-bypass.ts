/**
 * The guards of the dev server's sign-in bypass (doc 16): it lets whoever reaches the admin in without signing in, so being the dev server is not
 * enough. The process must not look deployed, and the browser must prove it runs on this machine.
 *
 * A request's own headers cannot prove that: `Host`, `X-Forwarded-Host` and `X-Forwarded-For` are whatever the sender wrote, and a framework
 * passes them on as they came. The proof is a ticket only a program on this machine can fetch (`DevProof`): the adapter listens on the loopback
 * address, which nothing outside the machine reaches, and the admin's page fetches a one-time ticket there and hands it in (`auth.devSignIn`).
 * The headers are still read, to turn away early what does not even claim to be local.
 */

/** Where a browser on this machine gets a one-time ticket, and the check that a ticket handed in is one of them. */
export type DevProof = {
	/** The loopback address that gives a ticket; `null` until the listener is up. */
	url(): string | null;
	/** Whether this ticket was given out and not used or ended yet. It is used up by the asking. */
	take(ticket: string): boolean;
};

type Env = Readonly<Record<string, string | undefined>>;

/** Variables the hosting platforms set on their servers: with one of them the process is not a developer's machine. */
const HOSTED = [
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

/** The hosting platform's variable this process has, or `undefined` on a developer's machine (and in a browser, where the stories run the API). */
export const hostedBy = (env: Env = typeof process === "undefined" ? {} : process.env): string | undefined =>
	HOSTED.find((name) => env[name]);

/** Whether a host name (no port) is this machine: `localhost`, `*.localhost`, `127.0.0.0/8` or `::1`. */
function isLoopback(hostname: string): boolean {
	const name = hostname
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/^::ffff:/, "");
	return name === "localhost" || name.endsWith(".localhost") || name === "::1" || /^127(\.\d{1,3}){3}$/.test(name);
}

/** The host name of a `Host`-style value (`example.com:3000`, `[::1]:3000`). */
function hostnameOf(host: string): string {
	const value = host.trim();
	if (value.startsWith("[")) return value.slice(0, value.indexOf("]") + 1);
	// A bare IPv6 address has several colons and no port.
	return value.split(":").length > 2 ? value : (value.split(":")[0] ?? "");
}

/**
 * Whether a request says it comes from this machine: its `Host` (the URL's when the header is not there), a proxy's `X-Forwarded-Host` and every
 * address of `X-Forwarded-For` are loopback names. A client can send these headers itself, so this proves nothing: it only turns away early what
 * does not claim to be local. The proof is the `DevProof` ticket.
 */
export function isLocalRequest(request: Pick<Request, "headers" | "url">): boolean {
	const host = request.headers.get("host") ?? new URL(request.url).host;
	if (!host || !isLoopback(hostnameOf(host))) return false;
	const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0];
	if (forwardedHost && !isLoopback(hostnameOf(forwardedHost))) return false;
	const forwardedFor = request.headers.get("x-forwarded-for");
	return forwardedFor ? forwardedFor.split(",").every((address) => isLoopback(address)) : true;
}

/** Who a bypassed session is: no account, the dev server itself. */
export const DEV_WHO = "dev";
