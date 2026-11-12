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

/** What a browser says of a file before it sends it: its name, its size, and its first bytes (base64), which say what it is. */
const TicketBody = z.object({
	name: z.string(),
	size: z.number().int().nonnegative(),
	// Decoded here, so text that is not base64 is a body the route does not take (400), not a failure of the server.
	head: z
		.string()
		.max(8192)
		.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
		.transform((text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0))),
});
const SealedBody = z.object({ key: z.string() });

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
const SIGN_IN = new Set(["auth.signIn", "auth.createFirstAdmin", "auth.devSignIn"]);

/**
 * The admin API: one route per operation, `POST …/operations/<name>` with `{ input, versions }`, made from the operation list, one per stream,
 * `POST …/streams/<name>` with `{ input }`, answered line by line, and the GitHub sign-in routes. A request needs the session cookie except for the open operations (signing in). It takes a web `Request`, so any framework can
 * mount it.
 */
export function createAdminApi(monti: Monti, options: AdminApiOptions = {}) {
	const github = monti.site.auth.github;
	/** The admin page of a GitHub route: the folder over the API's (`/admin/api/auth/github` → `/admin`). */
	const adminPathOf = (pathname: string) =>
		options.adminPath ?? (pathname.replace(/\/[^/]+\/auth\/github(\/callback)?$/, "") || "/");
	// The dev server lets a browser of this machine in without signing in (doc 16): never the live site or a hosted process, and only a browser
	// that handed in a ticket from this machine's loopback address (`auth.devSignIn`). What the request says of itself (`isLocalRequest`) proves
	// nothing; it only turns away early what does not even claim to be local.
	const bypassOn =
		monti.site.files !== null &&
		monti.site.auth.devBypass &&
		monti.site.devProof !== null &&
		hostedBy(options.env) === undefined;
	const bypasses = (request: Request) => bypassOn && isLocalRequest(request);
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
				await monti.cleanUp();
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
		const local = bypasses(request);
		// The ticket is asked for only where the bypass can hold at all.
		if (name === "auth.devSignIn" && !local) return json(401, { error: "sign-in-refused" });
		const answer = await call(name, await request.json().catch(() => null), cookies(request)[SESSION_COOKIE], local);
		// Where to prove itself is said only to a request the bypass can hold for.
		if (name === "auth.state" && !local && answer.status === 200)
			delete (answer.body as { devProof?: string }).devProof;
		if (answer.session === undefined) return json(answer.status, answer.body);
		const setCookie =
			answer.session === null
				? cookie(request, SESSION_COOKIE, "", 0)
				: sessionCookie(request, answer.session.token, answer.session.expiresAt);
		return json(answer.status, answer.body, { "set-cookie": setCookie });
	}

	/**
	 * A stream as the admin API answers it (docs 00 and 10): `events` gives its events as they come. What goes wrong before the first event is an
	 * answer with a status, like an operation's; what goes wrong later is the stream's last event, `{ type: "error", … }`, since the answer has
	 * already begun. `signal` ends it when whoever listens goes away.
	 */
	async function stream(
		name: string,
		rawBody: unknown,
		token: string | null | undefined,
		signal: AbortSignal,
		/** The request is one the dev server's bypass lets in. */
		local = false,
	): Promise<{ status: number; body: unknown } | { status: 200; events: AsyncIterable<unknown> }> {
		// As an operation's: a bypassed session opens a stream only while the bypass holds for the request.
		const session = await sessionOf(token, local);
		if (!session) return { status: 401, body: { error: "unauthenticated" } };
		const body = Body.safeParse(rawBody);
		if (!body.success) return { status: 400, body: { error: "invalid-body" } };
		let events: AsyncIterator<unknown>;
		let first: IteratorResult<unknown>;
		try {
			events = monti.stream(name, body.data.input ?? {}, { actor: "admin", session, signal })[Symbol.asyncIterator]();
			first = await events.next();
		} catch (error) {
			const described = describeError(error);
			if (described) return described;
			throw error;
		}
		async function* rest() {
			try {
				for (let next = first; !next.done; next = await events.next()) yield next.value;
			} catch (error) {
				const described = describeError(error);
				if (!described) console.error(`Monti: the stream ${name} failed:`, error);
				yield { type: "error", ...(described?.body ?? { error: "unexpected" }) };
			} finally {
				await events.return?.();
			}
		}
		return { status: 200, events: rest() };
	}

	/** The stream's events as the answer's body: one JSON object per line, sent as each comes. */
	async function streamed(request: Request, name: string): Promise<Response> {
		const answer = await stream(
			name,
			await request.json().catch(() => null),
			cookies(request)[SESSION_COOKIE],
			request.signal,
			bypasses(request),
		);
		if (!("events" in answer)) return json(answer.status, answer.body);
		const events = answer.events[Symbol.asyncIterator]();
		const encoder = new TextEncoder();
		return new Response(
			new ReadableStream<Uint8Array>({
				async pull(controller) {
					const next = await events.next();
					if (next.done) controller.close();
					else controller.enqueue(encoder.encode(`${JSON.stringify(next.value)}\n`));
				},
				// The browser went away: the stream ends with it.
				async cancel() {
					await events.return?.();
				},
			}),
			{ headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" } },
		);
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

	/** The library will not take the file: too big, or not a kind it takes. */
	const refusal = (reason: "size" | "type") =>
		reason === "size"
			? { status: 413, body: { error: "media-refused", reason: { key: "media.tooBig" } } }
			: { status: 415, body: { error: "media-refused", reason: { key: "media.badType" } } };

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
		if (!accepted.ok) return refusal(accepted.reason);
		const key = `${randomUUID()}${accepted.extension}`;
		await storage.put(key, bytes, { mime: accepted.mime });
		// Until `media.upload` makes it a file's: an upload that stops here is removed by the clean-up (doc 11). Its bytes were read here: sealed.
		await loosen(monti.db, [key], looseUntil(monti.now()), { sealed: true });
		return { status: 200, body: { key, mime: accepted.mime, size: bytes.length } };
	}

	/**
	 * The direct way up, first step (doc 20): a host may take smaller requests than the library's largest file, so the bytes go from the browser
	 * straight to the storage. The same rule answers here as on the byte route, from the file's first bytes; the key is the server's, and the
	 * address it hands back is signed for that key, type and size alone. A storage that takes no direct uploads answers `direct: false`, and
	 * the browser uses the byte route.
	 */
	async function ticket(
		file: { name: string; size: number; head: Uint8Array },
		token: string | null | undefined,
		local = false,
	): Promise<{ status: number; body: unknown }> {
		if (!(await sessionOf(token, local))) return { status: 401, body: { error: "unauthenticated" } };
		const storage = monti.site.storage;
		if (!storage) return { status: 422, body: { error: "check-failed", reason: { key: "media.noStorage" } } };
		if (!storage.ticket) return { status: 200, body: { direct: false } };
		const accepted = acceptFile({ name: file.name, size: file.size, head: file.head.subarray(0, HEAD_BYTES) });
		if (!accepted.ok) return refusal(accepted.reason);
		const key = `${randomUUID()}${accepted.extension}`;
		// Listed before the address exists, and for longer than the address works (a day; the address, minutes): whatever is sent to it, once or
		// again after the seal, is removed by the clean-up (doc 11). The row keeps the size the address is signed for.
		await loosen(monti.db, [key], looseUntil(monti.now()), { ticketSize: file.size });
		const { url, headers } = await storage.ticket(key, { mime: accepted.mime, size: file.size });
		return { status: 200, body: { direct: true, key, url, headers } };
	}

	/**
	 * The direct way up, last step: the browser says the file is in the storage, and the server looks at what is there. Nothing the browser said
	 * is taken for it. The uploaded file is first copied to a key of the server's own, one no browser was ever handed an address for, and the
	 * copy is what is checked: its size is the one the ticket was signed for, and its type is what its bytes say, by the rule of the byte route,
	 * and the type the address was signed for. So what was checked cannot change afterwards: the signed address still works for some minutes,
	 * but what is sent to it lands on the old key, which nothing names and the clean-up removes. The answer is the new key, marked sealed:
	 * `media.upload` takes no other.
	 */
	async function sealed(
		key: string,
		token: string | null | undefined,
		local = false,
	): Promise<{ status: number; body: unknown }> {
		if (!(await sessionOf(token, local))) return { status: 401, body: { error: "unauthenticated" } };
		const storage = monti.site.storage;
		if (!storage) return { status: 422, body: { error: "check-failed", reason: { key: "media.noStorage" } } };
		const missing = { status: 404, body: { error: "not-found" } };
		// Only a key this server signed an address for, and only once its file is there.
		const waiting = isMediaKey(key)
			? await monti.db
					.selectFrom("loose_files")
					.select("ticket_size")
					.where("key", "=", key)
					.where("ticket_size", "is not", null)
					.executeTakeFirst()
			: undefined;
		if (!waiting) return missing;
		const uploaded = await storage.stat(key);
		if (!uploaded) return missing;
		// The ticket is used up here, whatever follows: of two seals of one key only one goes on. The row stays, so the key is still cleaned up.
		const taken = await monti.db
			.updateTable("loose_files")
			.set({ ticket_size: null })
			.where("key", "=", key)
			.where("ticket_size", "is not", null)
			.returning("key")
			.executeTakeFirst();
		if (!taken) return missing;

		const copy = `${randomUUID()}${key.slice(36)}`;
		// Listed before it is made: a copy the server does not get to check is removed like any upload that stopped.
		await loosen(monti.db, [copy], looseUntil(monti.now()));
		const drop = async (answer: { status: number; body: unknown }) => {
			await storage.remove(copy);
			await monti.db.deleteFrom("loose_files").where("key", "=", copy).execute();
			await storage.remove(key);
			return answer;
		};
		// Before a byte of it is copied or read.
		if (uploaded.size > MAX_UPLOAD_BYTES) return drop(refusal("size"));
		if (storage.copy) await storage.copy(key, copy);
		else {
			const file = await storage.read(key);
			if (!file) return drop(missing);
			await storage.put(copy, file.bytes, { mime: file.mime });
		}
		const stored = await storage.stat(copy);
		const head = stored
			? storage.readStart
				? await storage.readStart(copy, HEAD_BYTES)
				: ((await storage.read(copy))?.bytes.subarray(0, HEAD_BYTES) ?? null)
			: null;
		if (!stored || !head) return drop(missing);
		// Not the size the address was signed for: the storage let something else through.
		if (stored.size !== waiting.ticket_size)
			return drop({
				status: 409,
				body: { error: "media-refused", reason: { key: "media.unknownKey", values: { key } } },
			});
		// The key carries the extension the ticket gave it: the bytes must be of that kind, and stored under that type.
		const accepted = acceptFile({ name: copy, size: stored.size, head });
		if (!accepted.ok) return drop(refusal(accepted.reason));
		if (accepted.mime !== stored.mime) return drop(refusal("type"));
		await monti.db.updateTable("loose_files").set({ sealed: true }).where("key", "=", copy).execute();
		await storage.remove(key);
		return { status: 200, body: { key: copy, mime: accepted.mime, size: stored.size } };
	}

	/** A small JSON body, or `null` when it is not one. */
	async function jsonBody<Shape>(request: Request, shape: z.ZodType<Shape>): Promise<Shape | null> {
		const parsed = shape.safeParse(await request.json().catch(() => null));
		return parsed.success ? parsed.data : null;
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
		const streamName = pathname.match(/\/streams\/([\w.]+)$/)?.[1];
		if (streamName && request.method === "POST") return streamed(request, streamName);
		if (pathname.endsWith("/media/bytes") && request.method === "PUT") {
			// Before the body: nobody without a session makes the server hold a file.
			const token = cookies(request)[SESSION_COOKIE];
			const local = bypasses(request);
			if (!(await sessionOf(token, local))) return json(401, { error: "unauthenticated" });
			const bytes = await bodyBytes(request);
			if (!bytes) return json(413, { error: "media-refused", reason: { key: "media.tooBig" } });
			const answer = await upload(bytes, searchParams.get("name") ?? "", token, local);
			return json(answer.status, answer.body);
		}
		if (pathname.endsWith("/media/ticket") && request.method === "POST") {
			const body = await jsonBody(request, TicketBody);
			if (!body) return json(400, { error: "invalid-body" });
			const answer = await ticket(body, cookies(request)[SESSION_COOKIE], bypasses(request));
			return json(answer.status, answer.body);
		}
		if (pathname.endsWith("/media/sealed") && request.method === "POST") {
			const body = await jsonBody(request, SealedBody);
			if (!body) return json(400, { error: "invalid-body" });
			const answer = await sealed(body.key, cookies(request)[SESSION_COOKIE], bypasses(request));
			return json(answer.status, answer.body);
		}
		const file = pathname.match(/\/media\/files\/([^/]+)$/)?.[1];
		if (file && request.method === "GET") return mediaFile(file);
		const githubRoute = pathname.match(/\/auth\/github(\/callback)?$/);
		if (githubRoute && request.method === "GET") return githubSignIn(request, githubRoute[1] !== undefined);
		return json(404, { error: "not-found" });
	};
	return Object.assign(handle, { call, upload, ticket, sealed, stream });
}
