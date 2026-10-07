import { createSite } from "@monti-cms/core/client";
import type { AuthCreateContext, CmsAuth } from "@monti-cms/core/server";
import { createSecretsVault } from "@monti-cms/core/testing";
import { vi } from "vitest";
import { testConfig } from "../../../core/test/site";
import { type AuthOptions, auth } from "../auth";

export const SECRET = "test-secret-test-secret-test-secret";
export const ORIGIN = "http://localhost:3000";
export const LOGIN_PATH = "/studio/login";

/** A login connection built the way the core builds it. */
export const connect = (options: AuthOptions, context: Partial<AuthCreateContext> = {}): CmsAuth => {
	// A `github()` with no arguments reads its OAuth app from the environment.
	vi.stubEnv("AUTH_GITHUB_ID", "id");
	vi.stubEnv("AUTH_GITHUB_SECRET", "secret");
	return connectWithEnv(options, context);
};

/** Like {@link connect}, with the environment as it is. */
export const connectWithEnv = (options: AuthOptions, context: Partial<AuthCreateContext> = {}): CmsAuth =>
	auth(options).create({
		site: createSite(testConfig),
		loginPath: LOGIN_PATH,
		trustHost: true,
		secrets: createSecretsVault({ secret: SECRET }).forPlugin("auth"),
		storage: () => {
			throw new Error("this test does not use plugin storage");
		},
		...context,
	});

/** The `name=value` cookies a response sets, as a `Cookie` header (a browser's cookie jar, without expiry). */
export class CookieJar {
	private readonly cookies = new Map<string, string>();

	store(response: Response) {
		for (const line of response.headers.getSetCookie()) {
			const [pair = "", ...attributes] = line.split(";");
			const index = pair.indexOf("=");
			const name = pair.slice(0, index).trim();
			const value = pair.slice(index + 1).trim();
			const expired = attributes.some((attribute) => /^\s*max-age=0/i.test(attribute)) || value === "";
			if (expired) this.cookies.delete(name);
			else this.cookies.set(name, value);
		}
	}

	header() {
		return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
	}

	names() {
		return [...this.cookies.keys()];
	}
}

/** What the pretend OAuth server (the provider's token and user endpoints) answers. */
export interface FakeOAuthServer {
	readonly tokenUrl: string;
	readonly userUrl: string;
	readonly user: Record<string, unknown>;
}

/** Replaces `fetch` so the provider's token and user endpoints answer from `servers`. Returns the calls made, for assertions. */
export const stubOAuthServers = (...servers: FakeOAuthServer[]) => {
	const calls: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input instanceof Request ? input.url : input);
			calls.push(url);
			for (const server of servers) {
				if (url.startsWith(server.tokenUrl)) {
					return Response.json({ access_token: "token", token_type: "bearer", scope: "read:user" });
				}
				if (url === server.userUrl) return Response.json(server.user);
			}
			// GitHub also asks for the emails of the account when the profile has none.
			if (url.endsWith("/user/emails"))
				return Response.json([{ email: "mina@example.com", primary: true, verified: true }]);
			return new Response("unexpected request", { status: 500 });
		}),
	);
	return calls;
};

/**
 * Runs the whole browser flow: the sign-in form post, the redirect to the provider, the provider's redirect back with a code, and the session cookie.
 * Returns the cookies of the browser afterwards and the redirect the callback ended with.
 */
export async function loginThrough(cmsAuth: CmsAuth, providerId: string, origin = ORIGIN) {
	const jar = new CookieJar();
	const signIn = await cmsAuth.signIn(providerId, {
		redirectTo: "/studio",
		request: new Request(`${origin}/api/cms/v1/session/sign-in/${providerId}`, { method: "POST" }),
	});
	const redirect = signIn as Response;
	jar.store(redirect);
	const authorize = new URL(redirect.headers.get("location") ?? "");
	const callback = await cmsAuth.handlers.GET(
		new Request(
			`${origin}${cmsAuth.basePath}/callback/${providerId}?code=code&state=${authorize.searchParams.get("state")}`,
			{ headers: { cookie: jar.header() } },
		),
	);
	jar.store(callback);
	return { jar, authorize, callback };
}

export const requestWith = (jar: CookieJar, origin = ORIGIN) =>
	new Request(`${origin}/studio`, { headers: { cookie: jar.header(), host: new URL(origin).host } });
