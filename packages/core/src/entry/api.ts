import { z } from "zod";
import { randomToken } from "../auth/secrets";
import { findSession, type Session, startSession } from "../auth/session";
import type { Monti } from "../monti";
import { describeError } from "./errors";

export type AdminApiOptions = {
	/** Where the admin screens are, for the GitHub sign-in to come back to. `/admin` when left out. */
	adminPath?: string;
	/** The `fetch` the GitHub sign-in calls GitHub with (tests replace it). */
	fetch?: typeof fetch;
};

const Body = z.object({ input: z.unknown().optional(), versions: z.record(z.string(), z.number()).optional() });

export const SESSION_COOKIE = "monti_session";
const STATE_COOKIE = "monti_github_state";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const cookies = (request: Request) =>
	Object.fromEntries(
		(request.headers.get("cookie") ?? "")
			.split(";")
			.map((part) => part.trim().split("="))
			.filter(([name, value]) => name && value !== undefined)
			.map(([name, value]) => [name, decodeURIComponent(value)]),
	);

const cookie = (request: Request, name: string, value: string, maxAge: number) =>
	`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
		new URL(request.url).protocol === "https:" ? "; Secure" : ""
	}`;

/** The operations whose output carries a new session's token: the API puts it in the cookie and never in the body. */
const SIGN_IN = new Set(["auth.signIn", "auth.createFirstAdmin"]);

/**
 * The admin API: one route per operation, `POST …/operations/<name>` with `{ input, versions }`, made from the operation list, and the GitHub
 * sign-in routes. A request needs the session cookie except for the open operations (signing in). It takes a web `Request`, so any framework can
 * mount it.
 */
export function createAdminApi(monti: Monti, options: AdminApiOptions = {}) {
	const adminPath = options.adminPath ?? "/admin";
	const github = monti.site.auth.github;
	const sessionCookie = (request: Request, token: string, expiresAt: Date) =>
		cookie(request, SESSION_COOKIE, token, Math.round((expiresAt.getTime() - monti.now().getTime()) / 1000));

	async function operation(request: Request, name: string, session: Session | null): Promise<Response> {
		const found = monti.operations.get(name);
		if (!found?.open && !session) return json(401, { error: "unauthenticated" });
		const body = Body.safeParse(await request.json().catch(() => null));
		if (!body.success) return json(400, { error: "invalid-body" });
		try {
			const result = await monti.run(name, body.data.input ?? {}, {
				actor: "admin",
				versions: body.data.versions,
				session,
			});
			if (name === "auth.signOut") return json(200, result, { "set-cookie": cookie(request, SESSION_COOKIE, "", 0) });
			if (!SIGN_IN.has(name)) return json(200, result);
			const { output, ...rest } = result as {
				output: { ok: boolean; token?: string; expiresAt?: Date; reason?: unknown };
			};
			if (!output.ok || !output.token || !output.expiresAt)
				return json(401, { error: "sign-in-refused", reason: output.reason });
			const { token, ...shown } = output;
			return json(200, { ...rest, output: shown }, { "set-cookie": sessionCookie(request, token, output.expiresAt) });
		} catch (error) {
			const described = describeError(error);
			if (described) return json(described.status, described.body);
			throw error;
		}
	}

	/** GitHub's sign-in: send the browser to GitHub, then take its answer and sign in the one account the config names (doc 15). */
	async function githubSignIn(request: Request, back: boolean): Promise<Response> {
		if (!github) return json(404, { error: "not-found" });
		const url = new URL(request.url);
		if (!back) {
			const state = randomToken();
			const authorize = new URL("https://github.com/login/oauth/authorize");
			authorize.searchParams.set("client_id", github.clientId);
			authorize.searchParams.set("redirect_uri", `${url.origin}${url.pathname}/callback`);
			authorize.searchParams.set("state", state);
			return new Response(null, {
				status: 302,
				headers: { location: authorize.toString(), "set-cookie": cookie(request, STATE_COOKIE, state, 600) },
			});
		}
		const state = url.searchParams.get("state");
		if (!state || state !== cookies(request)[STATE_COOKIE]) return json(400, { error: "bad-state" });
		const call = options.fetch ?? fetch;
		const token = (await (
			await call("https://github.com/login/oauth/access_token", {
				method: "POST",
				headers: { accept: "application/json", "content-type": "application/json" },
				body: JSON.stringify({
					client_id: github.clientId,
					client_secret: github.clientSecret,
					code: url.searchParams.get("code"),
				}),
			})
		).json()) as { access_token?: string };
		if (!token.access_token) return json(400, { error: "github-refused" });
		const user = (await (
			await call("https://api.github.com/user", {
				headers: { accept: "application/json", authorization: `Bearer ${token.access_token}`, "user-agent": "monti" },
			})
		).json()) as { login?: string };
		const login = user.login ?? "";
		const done = (location: string, setCookie?: string) => {
			const headers = new Headers({ location });
			headers.append("set-cookie", cookie(request, STATE_COOKIE, "", 0));
			if (setCookie) headers.append("set-cookie", setCookie);
			return new Response(null, { status: 302, headers });
		};
		if (login.toLowerCase() !== github.admin.toLowerCase())
			return done(`${adminPath}?denied=${encodeURIComponent(login)}`);
		const started = await startSession(monti.db, `github:${login}`, monti.now());
		return done(adminPath, sessionCookie(request, started.token, started.expiresAt));
	}

	return async (request: Request): Promise<Response> => {
		const { pathname } = new URL(request.url);
		const session = await findSession(monti.db, cookies(request)[SESSION_COOKIE], monti.now());
		const name = pathname.match(/\/operations\/([\w.]+)$/)?.[1];
		if (name && request.method === "POST") return operation(request, name, session);
		const githubRoute = pathname.match(/\/auth\/github(\/callback)?$/);
		if (githubRoute && request.method === "GET") return githubSignIn(request, githubRoute[1] !== undefined);
		return json(404, { error: "not-found" });
	};
}
