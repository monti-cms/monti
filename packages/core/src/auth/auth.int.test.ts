import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { createAdminApi, SESSION_COOKIE } from "../entry/api";
import { runCli } from "../entry/cli";
import { agentTools } from "../entry/tools";
import { createMonti, type MontiOptions } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
import { schemaFilesAt } from "../schema/files";
import { resetAdminPassword } from "./reset";

const db = await testDatabase();

const schema = defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

let clock = new Date("2026-11-05T09:00:00Z");
const site = (options: Partial<MontiOptions> = {}) =>
	createMonti({ db, schema, auth: { password: true }, now: () => clock, ...options });

/** A browser: it keeps the cookie the admin API sets, like a real one. */
function browser(monti = site(), extra: Parameters<typeof createAdminApi>[1] = {}) {
	const api = createAdminApi(monti, extra);
	let jar = "";
	const send = async (request: Request) => {
		const headers = new Headers(request.headers);
		if (jar) headers.set("cookie", `${SESSION_COOKIE}=${jar}`);
		const response = await api(new Request(request, { headers }));
		for (const set of response.headers.getSetCookie())
			if (set.startsWith(`${SESSION_COOKIE}=`))
				jar = decodeURIComponent(set.split(";")[0].slice(SESSION_COOKIE.length + 1));
		return response;
	};
	return {
		send,
		cookie: () => jar,
		call: async (name: string, input: unknown = {}) => {
			const response = await send(
				new Request(`https://site.test/admin/api/operations/${name}`, {
					method: "POST",
					body: JSON.stringify({ input }),
				}),
			);
			return { status: response.status, body: await response.json(), headers: response.headers };
		},
	};
}

const first = { email: "Me@Site.test", password: "correct horse", confirm: "correct horse" };

beforeEach(async () => {
	clock = new Date("2026-11-05T09:00:00Z");
	await sql`drop view if exists monti_post`.execute(db);
	for (const table of [
		"monti_session",
		"monti_admin",
		"monti_sign_in_attempt",
		"entries",
		"schema_state",
		"schema_changes",
		"monti_delivery",
		"monti_activity",
	] as const)
		await db.deleteFrom(table).execute();
	await migrateContent(db, schema, []);
});

describe("first admin and sign-in", () => {
	it("15-1 the first visit makes the first admin, who is signed in at once; a second first admin is told one exists", async () => {
		const me = browser();
		expect((await me.call("auth.state")).body).toEqual({
			methods: { password: true, external: [] },
			hasAdmin: false,
			session: null,
		});
		expect(
			(await me.call("auth.createFirstAdmin", { ...first, password: "short", confirm: "short" })).body,
		).toMatchObject({
			reason: { key: "auth.passwordShort" },
		});
		expect((await me.call("auth.createFirstAdmin", { ...first, confirm: "correct horse!" })).body).toMatchObject({
			reason: { key: "auth.passwordsDiffer" },
		});

		const made = await me.call("auth.createFirstAdmin", first);
		expect(made.status).toBe(200);
		expect(made.headers.get("set-cookie")).toContain("HttpOnly");
		expect(JSON.stringify(made.body)).not.toContain(me.cookie());
		expect((await me.call("auth.state")).body).toMatchObject({ hasAdmin: true, session: { who: "me@site.test" } });

		expect((await browser().call("auth.createFirstAdmin", { ...first, email: "other@site.test" })).body).toMatchObject({
			reason: { key: "auth.adminExists" },
		});
	});

	it("15-1 a wrong password is refused, five in a minute lock the email, and the lock lifts after a minute", async () => {
		await browser().call("auth.createFirstAdmin", first);
		const me = browser();
		const wrong = await me.call("auth.signIn", { email: first.email, password: "nope" });
		expect(wrong).toMatchObject({ status: 401, body: { reason: { key: "auth.wrong" } } });
		// The right password under another email is as wrong.
		expect((await me.call("auth.signIn", { email: "someone@else.test", password: first.password })).status).toBe(401);
		for (let index = 0; index < 4; index += 1) await me.call("auth.signIn", { email: first.email, password: "nope" });
		expect((await me.call("auth.signIn", { email: first.email, password: first.password })).body).toMatchObject({
			reason: { key: "auth.locked" },
		});
		clock = new Date(clock.getTime() + 61_000);
		const signedIn = await me.call("auth.signIn", { email: "  me@site.TEST ", password: first.password });
		expect(signedIn.status).toBe(200);
		expect((await me.call("frame.counts")).status).toBe(200);
	});

	it("15-1 a GitHub-only site has no email form and lets in only the account its config names", async () => {
		const github = { clientId: "id", clientSecret: "secret", admin: "monti-owner" };
		let login = "octo-kim";
		const fakeGitHub: typeof fetch = async (url) =>
			new Response(JSON.stringify(String(url).includes("access_token") ? { access_token: "gh-token" } : { login }), {
				headers: { "content-type": "application/json" },
			});
		const monti = site({ auth: { github } });
		const me = browser(monti, { fetch: fakeGitHub });
		expect((await me.call("auth.state")).body).toMatchObject({
			methods: { password: false, external: [{ id: "github", label: "GitHub", path: "auth/github" }] },
			hasAdmin: true,
		});
		expect((await me.call("auth.signIn", { email: "a@b.c", password: "x" })).body).toMatchObject({
			reason: { key: "auth.methodOff" },
		});

		const start = await me.send(new Request("https://site.test/admin/api/auth/github"));
		expect(start.status).toBe(302);
		const location = new URL(start.headers.get("location") ?? "");
		expect(location.origin).toBe("https://github.com");
		const state = location.searchParams.get("state") ?? "";
		const stateCookie = start.headers.getSetCookie()[0].split(";")[0];
		const back = (withState: string) =>
			me.send(
				new Request(`https://site.test/admin/api/auth/github/callback?code=c&state=${withState}`, {
					headers: { cookie: stateCookie },
				}),
			);

		expect((await back("forged")).status).toBe(400);
		const denied = await back(state);
		expect(denied.headers.get("location")).toBe("/admin?denied=octo-kim");
		expect(me.cookie()).toBe("");
		// Trying again after a refusal asks GitHub for its account picker; a first try does not.
		expect(location.searchParams.get("prompt")).toBeNull();
		const again = await me.send(new Request("https://site.test/admin/api/auth/github?pick=1"));
		expect(new URL(again.headers.get("location") ?? "").searchParams.get("prompt")).toBe("select_account");

		login = "Monti-Owner";
		const allowed = await back(state);
		expect(allowed.headers.get("location")).toBe("/admin");
		expect((await me.call("auth.state")).body).toMatchObject({ session: { who: "github:Monti-Owner" } });
	});

	it("15-1 a site with no way to sign in says so", async () => {
		expect((await browser(site({ auth: {} })).call("auth.state")).body).toMatchObject({
			methods: { password: false, external: [] },
		});
	});
});

describe("sessions", () => {
	it("15-4 without a session only the sign-in operations answer; a session ends after 30 idle days or on sign-out", async () => {
		const me = browser();
		expect((await me.call("frame.counts")).status).toBe(401);
		expect((await me.call("auth.state")).status).toBe(200);
		await me.call("auth.createFirstAdmin", first);
		expect((await me.call("frame.counts")).status).toBe(200);

		// Used on day 20, it lasts until day 50.
		clock = new Date(clock.getTime() + 20 * 86_400_000);
		expect((await me.call("frame.counts")).status).toBe(200);
		clock = new Date(clock.getTime() + 29 * 86_400_000);
		expect((await me.call("frame.counts")).status).toBe(200);
		clock = new Date(clock.getTime() + 31 * 86_400_000);
		expect((await me.call("frame.counts")).status).toBe(401);

		await me.call("auth.signIn", { email: first.email, password: first.password });
		const kept = me.cookie();
		const out = await me.call("auth.signOut");
		expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
		const replay = await createAdminApi(site())(
			new Request("https://site.test/admin/api/operations/frame.counts", {
				method: "POST",
				body: "{}",
				headers: { cookie: `${SESSION_COOKIE}=${kept}` },
			}),
		);
		expect(replay.status).toBe(401);
	});

	it("15-4 signing in is never an agent tool or a command", async () => {
		const monti = site();
		const names = agentTools(monti).map((tool) => tool.name);
		expect(names.filter((name) => name.startsWith("auth."))).toEqual([]);
		expect(names).toContain("frame.counts");
		const lines: string[] = [];
		await runCli(monti, ["help"], { out: (line) => lines.push(line), err: () => {} });
		expect(lines.some((line) => line.startsWith("auth.signIn") || line.startsWith("auth.state"))).toBe(false);
		expect(
			await runCli(monti, ["auth.signIn", "--email", "a", "--password", "b"], { out: () => {}, err: () => {} }),
		).toBe(1);
	});

	it("15-5 a reset password signs every browser out, lifts the lock and is the one that works", async () => {
		const me = browser();
		await me.call("auth.createFirstAdmin", first);
		const other = browser();
		for (let index = 0; index < 5; index += 1)
			await other.call("auth.signIn", { email: first.email, password: "nope" });
		await expect(resetAdminPassword(db, "short")).rejects.toThrow("at least 10");
		expect(await resetAdminPassword(db, "a brand new one")).toBe("me@site.test");
		expect((await me.call("frame.counts")).status).toBe(401);
		expect((await other.call("auth.signIn", { email: first.email, password: first.password })).status).toBe(401);
		expect((await other.call("auth.signIn", { email: first.email, password: "a brand new one" })).status).toBe(200);
	});
});

describe("the frame's counts", () => {
	it("15-2 the counts follow the schema's collections, with no screen code naming them", async () => {
		const me = browser();
		await me.call("auth.createFirstAdmin", first);
		expect((await me.call("frame.counts")).body).toEqual({ collections: { post: 0 }, trash: 0, failedDeliveries: 0 });
		const withNotes = defineSchema({
			locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
			collections: { ...schema.collections, note: { ...schema.collections.post, path: "/notes/:slug" } },
		});
		const later = browser(site({ schema: withNotes }));
		await later.call("auth.signIn", { email: first.email, password: first.password });
		expect((await later.call("frame.counts")).body).toMatchObject({ collections: { post: 0, note: 0 } });
	});

	it("15-3 trash and failed deliveries are counted as the trash and the activity log have them", async () => {
		const me = browser();
		await me.call("auth.createFirstAdmin", first);
		const monti = site({
			receivers: [{ destination: "webhook:down", send: async () => Promise.reject(new Error("down")) }],
		});
		for (const title of ["One", "Two", "Three"])
			await monti.run("entries.create", { collection: "post", locale: "ko", title }, { actor: "admin" });
		const [one] = await db.selectFrom("entries").select("id").where("title", "=", "One").execute();
		await db.updateTable("entries").set({ trashed_at: clock }).where("id", "=", one.id).execute();
		await db.updateTable("monti_delivery").set({ state: "failed" }).execute();
		const failed = await db.selectFrom("monti_delivery").select("id").where("state", "=", "failed").execute();
		expect((await me.call("frame.counts")).body).toEqual({
			collections: { post: 2 },
			trash: 1,
			failedDeliveries: failed.length,
		});
	});
});

describe("the dev server's sign-in bypass", () => {
	/** The adapter's part: tickets a program on this machine fetches from the loopback address. Here they are handed out by the test. */
	function proof() {
		const good = new Set<string>();
		let made = 0;
		return {
			give: () => {
				const ticket = `ticket-${++made}`;
				good.add(ticket);
				return ticket;
			},
			devProof: { url: () => "http://127.0.0.1:49152/", take: (ticket: string) => good.delete(ticket) },
		};
	}
	// The dev server: it has the way to the schema file. Nothing is written here, so any folder does.
	const dev = (devProof: MontiOptions["devProof"], auth: MontiOptions["auth"] = { password: true }) =>
		site({ files: schemaFilesAt("/nowhere"), auth, devProof });
	const LOCAL = "http://localhost:3000/admin/api/operations";
	const post = (url: string, input: unknown = {}, headers: Record<string, string> = {}) =>
		new Request(url, { method: "POST", body: JSON.stringify({ input }), headers });
	const stateOf = async (response: Response) => (await response.json()) as { session: unknown; devProof?: string };

	it("16-5 on the dev server a browser that hands in a ticket from this machine is let in without signing in, and auth.state says so", async () => {
		const tickets = proof();
		const me = browser(dev(tickets.devProof), { env: {} });
		// Not let in yet: nothing opens, and auth.state says where to get the ticket.
		expect((await me.send(post(`${LOCAL}/frame.counts`))).status).toBe(401);
		expect(await stateOf(await me.send(post(`${LOCAL}/auth.state`)))).toMatchObject({
			session: null,
			devProof: "http://127.0.0.1:49152/",
		});
		const let_in = await me.send(post(`${LOCAL}/auth.devSignIn`, { ticket: tickets.give() }));
		expect(let_in.status).toBe(200);
		// The session's token is in the cookie and nowhere in the answer.
		expect(await let_in.text()).not.toContain(me.cookie());
		expect((await me.send(post(`${LOCAL}/frame.counts`))).status).toBe(200);
		const state = await stateOf(await me.send(post(`${LOCAL}/auth.state`)));
		expect(state.session).toEqual({ who: "dev", bypass: true });
		expect(state.devProof).toBeUndefined();
		expect(await db.selectFrom("monti_session").select("who").execute()).toEqual([{ who: "dev" }]);
	});

	it("16-5 what a request says of itself lets nobody in: forged local headers without a ticket, a made-up ticket, a ticket used twice", async () => {
		const tickets = proof();
		const api = createAdminApi(dev(tickets.devProof), { env: {} });
		// A sender on another machine writes the headers a local request would have.
		const forged = { host: "localhost:3000", "x-forwarded-host": "localhost:3000", "x-forwarded-for": "127.0.0.1" };
		expect((await api(post("http://203.0.113.9/admin/api/operations/frame.counts", {}, forged))).status).toBe(401);
		expect((await api(post("http://203.0.113.9/admin/api/media/bytes?name=a.png", {}, forged))).status).toBe(404);
		const upload = new Request("http://203.0.113.9/admin/api/media/bytes?name=a.png", {
			method: "PUT",
			body: new Uint8Array(4),
			headers: forged,
		});
		expect((await api(upload)).status).toBe(401);
		expect((await api(post(`${LOCAL}/auth.devSignIn`, { ticket: "made-up" }, forged))).status).toBe(401);
		const ticket = tickets.give();
		const first = await api(post(`${LOCAL}/auth.devSignIn`, { ticket }));
		expect(first.status).toBe(200);
		const again = await api(post(`${LOCAL}/auth.devSignIn`, { ticket }));
		expect(again.status).toBe(401);
		expect(again.headers.get("set-cookie")).toBeNull();
		expect(await db.selectFrom("monti_session").select("who").execute()).toEqual([{ who: "dev" }]);
	});

	it("16-5 the live site, a request that is not local, a hosted process, devBypass: false and a server with no proof all sign in as always, ticket or not", async () => {
		const tickets = proof();
		const refused = async (monti: ReturnType<typeof site>, url = LOCAL, headers = {}, env = {}) => {
			const api = createAdminApi(monti, { env });
			const state = await stateOf(await api(post(`${url}/auth.state`, {}, headers)));
			const signIn = await api(post(`${url}/auth.devSignIn`, { ticket: tickets.give() }, headers));
			return [state.devProof, signIn.status, signIn.headers.get("set-cookie")];
		};
		// The live site: no schema file to write.
		expect(await refused(site({ devProof: tickets.devProof }))).toEqual([undefined, 401, null]);
		// Another machine, by its host or through a proxy.
		expect(await refused(dev(tickets.devProof), "https://site.test/admin/api/operations")).toEqual([
			undefined,
			401,
			null,
		]);
		expect(await refused(dev(tickets.devProof), "http://192.168.0.7:3000/admin/api/operations")).toEqual([
			undefined,
			401,
			null,
		]);
		expect(await refused(dev(tickets.devProof), LOCAL, { "x-forwarded-host": "site.test" })).toEqual([
			undefined,
			401,
			null,
		]);
		expect(await refused(dev(tickets.devProof), LOCAL, { "x-forwarded-for": "203.0.113.9" })).toEqual([
			undefined,
			401,
			null,
		]);
		// A name under `localhost` is not this machine for sure.
		expect(await refused(dev(tickets.devProof), "http://evil.localhost:3000/admin/api/operations")).toEqual([
			undefined,
			401,
			null,
		]);
		// A hosting platform's process, even in dev mode.
		expect(await refused(dev(tickets.devProof), LOCAL, {}, { VERCEL: "1" })).toEqual([undefined, 401, null]);
		// Turned off in the config, to try the sign-in screens locally.
		expect(await refused(dev(tickets.devProof, { password: true, devBypass: false }))).toEqual([undefined, 401, null]);
		// No adapter brought a proof: nobody is let in.
		expect(await refused(dev(null))).toEqual([undefined, 401, null]);
		expect(await db.selectFrom("monti_session").select("who").execute()).toEqual([]);
	});

	it("16-5 a session the bypass gave opens nothing once the bypass no longer holds", async () => {
		const tickets = proof();
		const me = browser(dev(tickets.devProof), { env: {} });
		await me.send(post(`${LOCAL}/auth.devSignIn`, { ticket: tickets.give() }));
		const replay = (monti: ReturnType<typeof site>, url: string, env = {}) =>
			createAdminApi(monti, { env })(post(url, {}, { cookie: `${SESSION_COOKIE}=${me.cookie()}` }));
		const local = `${LOCAL}/frame.counts`;
		expect((await replay(dev(tickets.devProof), local)).status).toBe(200);
		expect((await replay(dev(tickets.devProof), "https://site.test/admin/api/operations/frame.counts")).status).toBe(
			401,
		);
		expect((await replay(site({ devProof: tickets.devProof }), local)).status).toBe(401);
		expect((await replay(dev(tickets.devProof, { password: true, devBypass: false }), local)).status).toBe(401);
		expect((await replay(dev(tickets.devProof), local, { NETLIFY: "true" })).status).toBe(401);
		expect((await replay(dev(null), local)).status).toBe(401);
	});

	it("16-5 15-4 letting in is never an agent tool or a command, and a file goes up only with the session it gave", async () => {
		const tickets = proof();
		const monti = dev(tickets.devProof);
		expect(agentTools(monti).map((tool) => tool.name)).not.toContain("auth.devSignIn");
		const lines: string[] = [];
		await runCli(monti, ["help"], { out: (line) => lines.push(line), err: () => {} });
		expect(lines.some((line) => line.startsWith("auth.devSignIn"))).toBe(false);
		const me = browser(monti, { env: {} });
		const put = () =>
			me.send(
				new Request("http://localhost:3000/admin/api/media/bytes?name=a.png", {
					method: "PUT",
					body: new Uint8Array(4),
				}),
			);
		expect((await put()).status).toBe(401);
		await me.send(post(`${LOCAL}/auth.devSignIn`, { ticket: tickets.give() }));
		// Let in, the upload is then refused for its own reason (this site has no storage), not for a missing session.
		expect((await put()).status).toBe(422);
	});
});
