import { type DoctorCheck, fail, ok, warn } from "@monti-cms/core";
import { detectProxyPlatform } from "@monti-cms/core/adapters/auth";
import { CMS_AUTH_BASE_PATH } from "@monti-cms/core/server";
import { collectAdmins, ignoredAdminText } from "./admins";
import type { LoginProvider } from "./provider";
import { qualifyAccountId } from "./provider";

/** The login options `monti doctor` needs to look at. */
interface CheckOptions {
	readonly providers: readonly LoginProvider[];
	readonly admins?: readonly (string | undefined)[] | undefined;
	readonly basePath?: string | undefined;
}

const WHERE_TO_SET = ".env.local (and the environment settings of your host)";

type Env = Readonly<Record<string, string | undefined>>;

const isProduction = (env: Env) => env.NODE_ENV === "production";

/** Whether the process looks like a deployed one: production mode or a known hosting platform. */
const looksDeployed = (env: Env) => isProduction(env) || detectProxyPlatform(env) !== undefined;

const originOf = (value: string | undefined): string | undefined => {
	if (!value) return undefined;
	try {
		return new URL(value).origin;
	} catch {
		return undefined;
	}
};

/** The public address of the site as the login will see it: `AUTH_URL` wins (the login pins it), then the site's URL, else the dev server. */
function siteOrigin(env: Env, siteUrl: string | undefined): { origin: string; from: string } {
	const pinned = originOf(env.AUTH_URL?.trim() || env.NEXTAUTH_URL?.trim() || undefined);
	if (pinned) return { origin: pinned, from: env.AUTH_URL ? "AUTH_URL" : "NEXTAUTH_URL" };
	const site = originOf(siteUrl);
	if (site) return { origin: site, from: "SITE_URL" };
	return { origin: "http://localhost:3000", from: "the default (SITE_URL is not set)" };
}

/** The checks `auth()` adds to `monti doctor`: the providers' own checks, the admins, the site URL, host trust and the callback URL to register. */
export function authChecks(options: CheckOptions): readonly DoctorCheck[] {
	const basePath = (options.basePath ?? CMS_AUTH_BASE_PATH).replace(/\/$/, "");

	const providers: DoctorCheck = {
		id: "providers",
		title: "Login methods",
		run: () => ok(options.providers.map((provider) => provider.name).join(", ")),
	};

	const admins: DoctorCheck = {
		id: "admins",
		title: "Admins",
		run: ({ env }) => {
			const strict = isProduction(env);
			let result: ReturnType<typeof collectAdmins>;
			try {
				result = collectAdmins({ providers: options.providers, admins: options.admins });
			} catch (error) {
				return fail((error as Error).message.replace(/^\[cms-auth\] /, ""), {
					where: "monti.config.ts (auth)",
					fix: "correct the admin list as the message says",
				});
			}
			const { sets, ignored } = result;
			const listed = options.providers.flatMap((provider) =>
				[...(sets.get(provider.id) ?? [])].map((id) => qualifyAccountId(provider, id)),
			);
			const source = options.providers.find((provider) => provider.adminSource)?.adminSource;
			if (listed.length === 0) {
				const message =
					ignored.length > 0
						? "no usable admin is listed, so nobody can sign in"
						: "no admin is listed, so nobody can sign in";
				const details = {
					where:
						ignored.length > 0
							? ignored.map(ignoredAdminText).join(" ")
							: (source?.env ?? "the admins of the login provider"),
					fix: source
						? `put your account id in ${source.env} (${source.findId}); several ids go in one value separated by commas`
						: "list the admin account ids on the provider, or in `admins` of auth()",
				};
				return strict
					? fail(message, details)
					: warn(`${message} outside \`next dev\` (under \`next dev\` you are the admin without signing in)`, details);
			}
			if (ignored.length > 0) {
				return warn(
					`${ignored.length} admin entr${ignored.length === 1 ? "y is" : "ies are"} left out because ${ignored.length === 1 ? "it is" : "they are"} not an account id`,
					{
						where: ignored
							.map((item) => item.provider.adminSource?.env ?? `the admins of ${item.provider.id}`)
							.join(", "),
						fix: ignored.map(ignoredAdminText).join("\n"),
					},
				);
			}
			return ok(`${listed.length} admin${listed.length === 1 ? "" : "s"}: ${listed.join(", ")}`, {
				where: source?.env ?? "the admins of the login provider",
			});
		},
	};

	const siteUrl: DoctorCheck = {
		id: "site-url",
		title: "SITE_URL",
		run: ({ cms, env }) => {
			const value = env.SITE_URL?.trim() || cms.site.config.site?.url?.trim() || undefined;
			if (!value) {
				const message =
					"SITE_URL is not set, so the site does not know its public address (login callback URL, links in bodies written as full URLs)";
				const fix =
					"set SITE_URL to the public address, for example SITE_URL=https://your-domain.com, in the environment of the deployed site";
				return looksDeployed(env)
					? warn(message, { where: WHERE_TO_SET, fix })
					: ok(
							"not set; fine on a development machine (the dev server is http://localhost:3000). Set it where you deploy",
							{ where: "SITE_URL" },
						);
			}
			const origin = originOf(value);
			if (!origin) {
				return fail(`SITE_URL is not a valid address (${value})`, {
					where: WHERE_TO_SET,
					fix: "write it with the scheme, for example SITE_URL=https://your-domain.com",
				});
			}
			if (looksDeployed(env) && /^http:\/\/(localhost|127\.)/.test(origin)) {
				return warn(`SITE_URL points at ${origin}, but this environment looks like a deployed one`, {
					where: WHERE_TO_SET,
					fix: "set SITE_URL to the public address of the site, for example https://your-domain.com",
				});
			}
			return ok(origin, { where: "SITE_URL" });
		},
	};

	const trustHost: DoctorCheck = {
		id: "trust-host",
		title: "Host trust",
		run: ({ cms, env }) => {
			const trusted = cms.isHostTrusted();
			const flag = env.AUTH_TRUST_HOST?.trim();
			const platform = detectProxyPlatform(env);
			const reason = flag
				? `AUTH_TRUST_HOST=${flag}`
				: platform
					? `${platform} is set, a known hosting platform`
					: !isProduction(env)
						? "NODE_ENV is not production"
						: "the `trustHost` option of the config";
			if (trusted) {
				return ok(
					`on (${reason}): login callback URLs are built from the request's host${
						isProduction(env)
							? ""
							: ". In production it is on only for a known platform (Vercel, Netlify, ...) or with AUTH_TRUST_HOST=true"
					}`,
				);
			}
			if (isProduction(env) && !env.AUTH_URL?.trim()) {
				return warn(
					"off, so login will fail with an UntrustedHost error: no known hosting platform is detected and AUTH_URL is not set",
					{
						where: "AUTH_TRUST_HOST, AUTH_URL, or `trustHost` in monti.config.ts",
						fix: "behind a proxy you run yourself (nginx, a load balancer) that overwrites X-Forwarded-Host, set AUTH_TRUST_HOST=true; otherwise set AUTH_URL to the public address of the site (https://your-domain.com)",
					},
				);
			}
			return ok(
				`off (${reason === "the `trustHost` option of the config" ? "the config or AUTH_TRUST_HOST says so" : reason}); the address of the site comes from AUTH_URL`,
			);
		},
	};

	const callback: DoctorCheck = {
		id: "callback-url",
		title: "Callback URL to register",
		run: ({ cms, env }) => {
			const oauth = options.providers.filter((provider) => provider.usesCallbackUrl);
			if (oauth.length === 0) return ok("no provider needs a callback URL");
			const { origin, from } = siteOrigin(env, env.SITE_URL?.trim() || cms.site.config.site?.url?.trim() || undefined);
			const urls = oauth.map((provider) => `${provider.name}: ${origin}${basePath}/callback/${provider.id}`);
			const note =
				from === "SITE_URL" || from === "AUTH_URL" || from === "NEXTAUTH_URL"
					? `(from ${from})`
					: `(SITE_URL is not set, so this is the development server's address); for the deployed site register https://<your-domain>${basePath}/callback/<provider> as well`;
			const authUrl = originOf(env.AUTH_URL?.trim() || undefined);
			const siteOnly = originOf(env.SITE_URL?.trim() || cms.site.config.site?.url?.trim() || undefined);
			if (authUrl && siteOnly && authUrl !== siteOnly) {
				return warn(`AUTH_URL (${authUrl}) and SITE_URL (${siteOnly}) are different addresses; login uses AUTH_URL`, {
					where: "AUTH_URL, SITE_URL",
					fix: `register the callback URL on the AUTH_URL address:\n${urls.join("\n")}\nor remove AUTH_URL if the site is served at SITE_URL`,
				});
			}
			return ok(`register this URL as the callback (redirect) URL of the OAuth app ${note}:\n${urls.join("\n")}`, {
				where:
					"the settings of the OAuth app, for GitHub: Settings, Developer settings, OAuth Apps, your app, Authorization callback URL",
			});
		},
	};

	return [
		providers,
		...options.providers.flatMap((provider) => provider.checks ?? []),
		admins,
		siteUrl,
		trustHost,
		callback,
	];
}
