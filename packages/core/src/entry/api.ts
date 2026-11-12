import { z } from "zod";
import { DEV_WHO, hostedBy, isLocalRequest } from "../auth/dev-bypass";
import { randomToken } from "../auth/secrets";
import { findSession, startSession } from "../auth/session";
import { randomUUID } from "../bytes";
import { acceptFile, HEAD_BYTES, isMediaKey, MAX_UPLOAD_BYTES } from "../media/accept";
import type { Monti } from "../monti";
import { loosen, looseUntil } from "../trash/purge";
import { describeError } from "./errors";

export type AdminApiOptions = {
	/**
	 * Where the admin screens are, for the GitHub sign-in to come back to. Left out, it is read from the request: the API sits one folder under the
	 * admin page (`/admin/api/…` is the API of `/admin`, doc 16).
	 */
	adminPath?: string;
	/** The process's environment, read for a hosting platform's mark (tests replace it). */
	env?: Readonly<Record<string, string | undefined>>;
	/** The `fetch` the GitHub sign-in calls GitHub with (tests replace it). */
	fetch?: typeof fetch;
};

const Body = z.object({
	input: z.unknown().optional(),
	versions: z.record(z.string(), z.number()).optional(),
	/** Proposal items taken in the screen and saved with this write (doc 05). */
	accepted: z.array(z.string()).optional(),
});

export const SESSION_COOKIE = "monti_session";
/** How often an open admin cleans the trash. */
const CLEAN_EVERY = 3_600_000;
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
	const github = monti.site.auth.github;
	/** The admin page of a GitHub route: the folder over the API's (`/admin/api/auth/github` → `/admin`). */
	const adminPathOf = (pathname: string) =>
		options.adminPath ?? (pathname.replace(/\/[^/]+\/auth\/github(\/callback)?$/, "") || "/");
	// The dev server lets a request from this machine in without signing in (doc 16): never the live site, a hosted process or a request from elsewhere.
	const bypassOn = monti.site.files !== null && monti.site.auth.devBypass && hostedBy(options.env) === undefined;
	const bypasses = (request: Request) => bypassOn && isLocalRequest(request);
	/**
	 * The request's session token: its cookie's, or for a bypassed request with no session, one started on the spot (`started`, to put in the cookie).
	 */
	async function tokenOf(request: Request) {
		const token = cookies(request)[SESSION_COOKIE];
		const local = bypasses(request);
		if (!local || (await sessionOf(token, local))) return { token, local };
		const started = await startSession(monti.db, DEV_WHO, monti.now());
		return { token: started.token, local, started };
	}
	/** A bypassed session is one only while the bypass holds for the request: turned off, or from another machine, it opens nothing. */
	async function sessionOf(token: string | null | undefined, local: boolean) {
		const session = await findSession(monti.db, token, monti.now());
		return session?.who === DEV_WHO && !local ? null : session;
	}
	let cleanedAt = Number.NEGATIVE_INFINITY;
	const sessionCookie = (request: Request, token: string, expiresAt: Date) =>
		cookie(request, SESSION_COOKIE, token, Math.round((expiresAt.getTime() - monti.now().getTime()) / 1000));

	/**
	 * One operation call as the admin API answers it, with the session's token in and out: `session` is the new session to keep (signing in), `null`
	 * to drop it (signing out). The HTTP handler puts it in the cookie; Storybook keeps it itself (a page script cannot read `Set-Cookie`).
	 */
	async function call(
		name: string,
		rawBody: unknown,
		token: string | null | undefined,
		/** The request is one the dev server's bypass lets in. */
		local = false,
	): Promise<{ status: number; body: unknown; session?: { token: string; expiresAt: Date } | null }> {
		const session = await sessionOf(token, local);
		const found = monti.operations.get(name);
		if (!found?.open && !session) return { status: 401, body: { error: "unauthenticated" } };
		// The admin's frame asks this when it opens: the trash is cleaned before it is counted, an hour apart at most (doc 11).
		if (name === "frame.counts" && monti.now().getTime() - cleanedAt >= CLEAN_EVERY) {
			// Set before it runs, so two frames opening at once clean once; put back when it fails, so the next frame tries again.
			const last = cleanedAt;
			cleanedAt = monti.now().getTime();
			try {
				await monti.trash.purgeDue();
			} catch (error) {
				cleanedAt = last;
				console.error("Monti: the trash clean-up failed; the next admin visit tries again:", error);
			}
		}
		const body = Body.safeParse(rawBody);
		if (!body.success) return { status: 400, body: { error: "invalid-body" } };
		try {
			const result = await monti.run(name, body.data.input ?? {}, {
				actor: "admin",
				versions: body.data.versions,
				accepted: body.data.accepted,
				session,
			});
			if (name === "auth.signOut") return { status: 200, body: result, session: null };
			if (!SIGN_IN.has(name)) return { status: 200, body: result };
			const { output, ...rest } = result as {
				output: { ok: boolean; token?: string; expiresAt?: Date; reason?: unknown };
			};
			if (!output.ok || !output.token || !output.expiresAt)
				return { status: 401, body: { error: "sign-in-refused", reason: output.reason } };
			const { token: made, ...shown } = output;
			return { status: 200, body: { ...rest, output: shown }, session: { token: made, expiresAt: output.expiresAt } };
		} catch (error) {
			const described = describeError(error);
			if (described) return described;
			throw error;
		}
	}

	async function operation(request: Request, name: string): Promise<Response> {
		const { token, local, started } = await tokenOf(request);
		const answer = await call(name, await request.json().catch(() => null), token, local);
		if (answer.session === undefined)
			return json(
				answer.status,
				answer.body,
				started ? { "set-cookie": sessionCookie(request, started.token, started.expiresAt) } : {},
			);
		const setCookie =
			answer.session === null
				? cookie(request, SESSION_COOKIE, "", 0)
				: sessionCookie(request, answer.session.token, answer.session.expiresAt);
		return json(answer.status, answer.body, { "set-cookie": setCookie });
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
			// After a refused account GitHub would send the same one straight back: `?pick=1` asks it to show its account picker.
			if (url.searchParams.get("pick") === "1") authorize.searchParams.set("prompt", "select_account");
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
		const adminPath = adminPathOf(url.pathname);
		if (login.toLowerCase() !== github.admin.toLowerCase())
			return done(`${adminPath}?denied=${encodeURIComponent(login)}`);
		const started = await startSession(monti.db, `github:${login}`, monti.now());
		return done(adminPath, sessionCookie(request, started.token, started.expiresAt));
	}

	/**
	 * A file's bytes on their way to the library (doc 09, the way up): this is the one route a screen reaches the server by that is not an operation, because an
	 * operation is JSON in one transaction. The browser asked `acceptFile` already; here the file's own bytes answer, and the key is the server's. `media.upload`
	 * makes the item from it.
	 */
	async function upload(
		bytes: Uint8Array,
		name: string,
		token: string | null | undefined,
		local = false,
	): Promise<{ status: number; body: unknown }> {
		if (!(await sessionOf(token, local))) return { status: 401, body: { error: "unauthenticated" } };
		const storage = monti.site.storage;
		if (!storage) return { status: 422, body: { error: "check-failed", reason: { key: "media.noStorage" } } };
		const accepted = acceptFile({ name, size: bytes.length, head: bytes.subarray(0, HEAD_BYTES) });
		if (!accepted.ok)
			return accepted.reason === "size"
				? { status: 413, body: { error: "media-refused", reason: { key: "media.tooBig" } } }
				: { status: 415, body: { error: "media-refused", reason: { key: "media.badType" } } };
		const key = `${randomUUID()}${accepted.extension}`;
		await storage.put(key, bytes, { mime: accepted.mime });
		// Until `media.upload` makes it a file's: an upload that stops here is removed by the clean-up (doc 11).
		await loosen(monti.db, [key], looseUntil(monti.now()));
		return { status: 200, body: { key, mime: accepted.mime, size: bytes.length } };
	}

	/** The request's body, or `null` past the largest file the library takes: it stops reading there, whatever the request said it holds. */
	async function bodyBytes(request: Request): Promise<Uint8Array | null> {
		if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return null;
		const chunks: Uint8Array[] = [];
		let size = 0;
		for await (const chunk of request.body ?? []) {
			size += chunk.length;
			if (size > MAX_UPLOAD_BYTES) return null;
			chunks.push(chunk);
		}
		const bytes = new Uint8Array(size);
		let at = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, at);
			at += chunk.length;
		}
		return bytes;
	}

	/**
	 * A file as it leaves: under its own type, never read as anything else, unable to run anything on this address. Only images show in place. A key is unguessable and
	 * written once, so what the site publishes needs no session, and a cache may keep it for good.
	 */
	async function mediaFile(key: string): Promise<Response> {
		const found = isMediaKey(key) ? await monti.site.storage?.read(key) : null;
		if (!found) return json(404, { error: "not-found" });
		const headers = new Headers({
			"content-type": found.mime,
			"content-length": String(found.bytes.length),
			"x-content-type-options": "nosniff",
			"content-security-policy": "sandbox",
			"cache-control": "public, max-age=31536000, immutable",
		});
		if (!found.mime.startsWith("image/")) {
			const row = await monti.db.selectFrom("media").select("name").where("original_key", "=", key).executeTakeFirst();
			headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(row?.name ?? key)}`);
		}
		// A copy of just these bytes: a storage may hand back a view of a larger pool (a Node `Buffer`), and its `slice` is no copy.
		return new Response(new Blob([new Uint8Array(found.bytes).buffer]), { headers });
	}

	const handle = async (request: Request): Promise<Response> => {
		const { pathname, searchParams } = new URL(request.url);
		const name = pathname.match(/\/operations\/([\w.]+)$/)?.[1];
		if (name && request.method === "POST") return operation(request, name);
		if (pathname.endsWith("/media/bytes") && request.method === "PUT") {
			// Before the body: nobody without a session makes the server hold a file.
			const { token, local, started } = await tokenOf(request);
			if (!(await sessionOf(token, local))) return json(401, { error: "unauthenticated" });
			const bytes = await bodyBytes(request);
			if (!bytes) return json(413, { error: "media-refused", reason: { key: "media.tooBig" } });
			const answer = await upload(bytes, searchParams.get("name") ?? "", token, local);
			return json(
				answer.status,
				answer.body,
				started ? { "set-cookie": sessionCookie(request, started.token, started.expiresAt) } : {},
			);
		}
		const file = pathname.match(/\/media\/files\/([^/]+)$/)?.[1];
		if (file && request.method === "GET") return mediaFile(file);
		const githubRoute = pathname.match(/\/auth\/github(\/callback)?$/);
		if (githubRoute && request.method === "GET") return githubSignIn(request, githubRoute[1] !== undefined);
		return json(404, { error: "not-found" });
	};
	return Object.assign(handle, { call, upload });
}
