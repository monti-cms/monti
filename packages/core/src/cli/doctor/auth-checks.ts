import { detectProxyPlatform, explainTrustHost } from "../../adapters/auth/trust-host";
import { CMS_AUTH_BASE_PATH } from "../../server/define";
import { githubLoginHowTo } from "../templates";
import type { CoreCheck, DoctorState } from "./core-checks";
import { fail, ok, skip, warn } from "./outcome";

/** The `auth` group of `monti doctor`: only the environment values and config values core itself knows about the GitHub login. */

const WHERE_TO_SET = ".env.local (and the environment settings of your host)";

const GITHUB_ID = "AUTH_GITHUB_ID";
const GITHUB_SECRET = "AUTH_GITHUB_SECRET";
const GITHUB_ADMIN = "MONTI_ADMIN_GITHUB_ID";

/** How to get the two values. */
const OAUTH_APP_FIX =
	"create a GitHub OAuth app (https://github.com/settings/developers, OAuth Apps, New OAuth App) whose callback URL is <your site>/api/cms/auth/callback/github (`monti doctor` prints it), then copy its Client ID into AUTH_GITHUB_ID and a new client secret into AUTH_GITHUB_SECRET";

type Env = DoctorState["env"];

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

/** The site URL: `SITE_URL`, else the `site.url` of the config. */
const siteUrlOf = (state: DoctorState): string | undefined =>
	state.env.SITE_URL?.trim() || state.cms?.site.config.site?.url?.trim() || undefined;

/** The public address of the site as the login will see it: `AUTH_URL` wins (the login pins it), then the site's URL, else the dev server. */
function siteOrigin(state: DoctorState): { origin: string; from: string } {
	const pinned = originOf(state.env.AUTH_URL?.trim() || state.env.NEXTAUTH_URL?.trim() || undefined);
	if (pinned) return { origin: pinned, from: state.env.AUTH_URL ? "AUTH_URL" : "NEXTAUTH_URL" };
	const site = originOf(siteUrlOf(state));
	if (site) return { origin: site, from: "SITE_URL" };
	return { origin: "http://localhost:3000", from: "the default (SITE_URL is not set)" };
}

/** In production a missing value breaks login; on a development machine the development login stands in, so it is a warning there. */
function missingGithubValue(name: string, env: Env) {
	const message = `${name} is not set, so nobody can sign in with GitHub${
		isProduction(env) ? "" : " (under `next dev` the development login is used instead)"
	}`;
	const details = { where: WHERE_TO_SET, fix: OAUTH_APP_FIX };
	return isProduction(env) ? fail(message, details) : warn(message, details);
}

/** Whether the config loaded and names no `auth` (the built-in no-login stands in). */
const hasNoLogin = (state: DoctorState): boolean => state.cms?.server.auth.name === "none";

/** The login-dependent checks have nothing to check when the config names no login. */
const withLogin = (check: CoreCheck): CoreCheck => ({
	...check,
	run: (state) => (hasNoLogin(state) ? skip("not checked: the config has no login") : check.run(state)),
});

/**
 * False only when the config loaded and its login has providers but none is GitHub, so a site with another login gets no GitHub checks.
 * When the config did not load, or the login cannot be created yet (a missing setting throws), the checks run.
 */
function usesGithub(state: DoctorState): boolean {
	if (!state.cms) return true;
	if (hasNoLogin(state)) return false;
	try {
		const providers = state.cms.auth().providers;
		return providers.length === 0 || providers.some((provider) => provider.id === "github");
	} catch {
		return true;
	}
}

/** Whether the config loaded and its login includes the built-in email and password method. */
function usesPassword(state: DoctorState): boolean {
	if (!state.cms || hasNoLogin(state)) return false;
	try {
		return state.cms.auth().providers.some((provider) => provider.credentials === true);
	} catch {
		return false;
	}
}

const githubOnly = (check: CoreCheck): CoreCheck => ({
	...check,
	run: (state) => (usesGithub(state) ? check.run(state) : skip("not checked: the login has no GitHub provider")),
});

const login: CoreCheck = {
	group: "auth",
	id: "login",
	title: "Login",
	needsCms: true,
	run: (state) => {
		if (!hasNoLogin(state)) return ok(state.cms?.server.auth.name ?? "set", { where: "auth in monti.config.ts" });
		const message = "the config has no login (`auth`), so nobody can sign in to the admin";
		const details = {
			where: "defineConfig in monti.config.ts",
			fix: githubLoginHowTo(siteOrigin(state).origin),
		};
		return looksDeployed(state.env)
			? fail(message, details)
			: warn(`${message} outside \`next dev\` (under \`next dev\` you are the admin without signing in)`, details);
	},
};

const githubId: CoreCheck = {
	group: "auth",
	id: "github-id",
	title: "GitHub client id",
	run: (state) =>
		state.env[GITHUB_ID]?.trim()
			? ok(`${GITHUB_ID} is set`, { where: GITHUB_ID })
			: missingGithubValue(GITHUB_ID, state.env),
};

const githubSecret: CoreCheck = {
	group: "auth",
	id: "github-secret",
	title: "GitHub client secret",
	run: (state) =>
		state.env[GITHUB_SECRET]?.trim()
			? ok(`${GITHUB_SECRET} is set`, { where: GITHUB_SECRET })
			: missingGithubValue(GITHUB_SECRET, state.env),
};

const FIND_ID = 'open https://api.github.com/users/<your-github-login> in a browser and copy the number after "id"';

const admins: CoreCheck = {
	group: "auth",
	id: "admins",
	title: "Admins",
	run: (state) => {
		const ids = (state.env[GITHUB_ADMIN] ?? "")
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean);
		if (ids.length === 0) {
			const message = "no admin is listed, so nobody can sign in";
			const details = {
				where: GITHUB_ADMIN,
				fix: `put your account id in ${GITHUB_ADMIN} (${FIND_ID}); several ids go in one value separated by commas`,
			};
			return isProduction(state.env)
				? fail(message, details)
				: warn(`${message} outside \`next dev\` (under \`next dev\` you are the admin without signing in)`, details);
		}
		const notIds = ids.filter((id) => !/^(github:)?\d+$/.test(id));
		if (notIds.length > 0) {
			return warn(
				`${notIds.length} admin entr${notIds.length === 1 ? "y is" : "ies are"} not a numeric GitHub id (${notIds.join(", ")})`,
				{
					where: GITHUB_ADMIN,
					fix: `use the numeric GitHub id, not the login (a login can be renamed and then taken by someone else): ${FIND_ID}`,
				},
			);
		}
		const listed = ids.map((id) => (id.includes(":") ? id : `github:${id}`));
		return ok(`${ids.length} admin${ids.length === 1 ? "" : "s"}: ${listed.join(", ")}`, { where: GITHUB_ADMIN });
	},
};

const adminAccounts: CoreCheck = {
	group: "auth",
	id: "admin-accounts",
	title: "Admin accounts",
	needsCms: true,
	run: async (state) => {
		if (!usesPassword(state)) return skip("not checked: the login is not email and password");
		let any: boolean | undefined;
		try {
			any = await state.cms?.auth().accounts?.hasAny();
		} catch (error) {
			return skip(
				`could not read the admin accounts (${error instanceof Error ? error.message : String(error)}); fix the database checks first`,
			);
		}
		if (any) return ok("at least one admin account exists", { where: "the database (plugin storage of `auth`)" });
		const adminUrl = `${siteOrigin(state).origin}${state.cms?.site.adminHref() ?? ""}`;
		return warn("no admin account exists yet, so nobody can sign in", {
			where: "the database",
			fix: `open the admin (${adminUrl}) and create the first admin: right after you deploy, or beforehand by running the app in production mode against the production database (under \`next dev\` you are the admin without signing in, so the screen does not show). A forgotten password: \`monti admin:reset-password\``,
		});
	},
};

const siteUrl: CoreCheck = {
	group: "auth",
	id: "site-url",
	title: "SITE_URL",
	needsCms: true,
	run: (state) => {
		const value = siteUrlOf(state);
		if (!value) {
			const message =
				"SITE_URL is not set, so the site does not know its public address (login callback URL, links in bodies written as full URLs)";
			const fix =
				"set SITE_URL to the public address, for example SITE_URL=https://your-domain.com, in the environment of the deployed site";
			return looksDeployed(state.env)
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
		if (looksDeployed(state.env) && /^http:\/\/(localhost|127\.)/.test(origin)) {
			return warn(`SITE_URL points at ${origin}, but this environment looks like a deployed one`, {
				where: WHERE_TO_SET,
				fix: "set SITE_URL to the public address of the site, for example https://your-domain.com",
			});
		}
		return ok(origin, { where: "SITE_URL" });
	},
};

const trustHost: CoreCheck = {
	group: "auth",
	id: "trust-host",
	title: "Host trust",
	needsCms: true,
	run: (state) => {
		const { env } = state;
		const trusted = state.cms?.isHostTrusted() ?? false;
		const { source } = explainTrustHost(state.cms?.server.trustHost, env);
		if (trusted) {
			return ok(
				`on (${source}): login callback URLs are built from the request's host${
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
		return ok(`off (${source}); the address of the site comes from AUTH_URL`);
	},
};

const callbackUrl: CoreCheck = {
	group: "auth",
	id: "callback-url",
	title: "Callback URL to register",
	needsCms: true,
	run: (state) => {
		const { origin, from } = siteOrigin(state);
		const url = `${origin}${CMS_AUTH_BASE_PATH}/callback/github`;
		const note =
			from === "SITE_URL" || from === "AUTH_URL" || from === "NEXTAUTH_URL"
				? `(from ${from})`
				: `(SITE_URL is not set, so this is the development server's address); for the deployed site register https://<your-domain>${CMS_AUTH_BASE_PATH}/callback/github as well`;
		const authUrl = originOf(state.env.AUTH_URL?.trim() || undefined);
		const siteOnly = originOf(siteUrlOf(state));
		if (authUrl && siteOnly && authUrl !== siteOnly) {
			return warn(`AUTH_URL (${authUrl}) and SITE_URL (${siteOnly}) are different addresses; login uses AUTH_URL`, {
				where: "AUTH_URL, SITE_URL",
				fix: `register the callback URL on the AUTH_URL address:\n${url}\nor remove AUTH_URL if the site is served at SITE_URL`,
			});
		}
		return ok(`register this URL as the callback (redirect) URL of the GitHub OAuth app ${note}:\n${url}`, {
			where:
				"the settings of the OAuth app, for GitHub: Settings, Developer settings, OAuth Apps, your app, Authorization callback URL",
		});
	},
};

export const AUTH_CHECKS: readonly CoreCheck[] = [
	login,
	githubOnly(githubId),
	githubOnly(githubSecret),
	githubOnly(admins),
	adminAccounts,
	siteUrl,
	withLogin(trustHost),
	githubOnly(withLogin(callbackUrl)),
];
