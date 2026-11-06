import { sql } from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import { testDatabase } from "../__test__/database";
import { createAdminApi, SESSION_COOKIE } from "../entry/api";
import { runCli } from "../entry/cli";
import { agentTools } from "../entry/tools";
import { createMonti, type MontiOptions } from "../monti";
import { migrateContent } from "../schema/apply";
import { defineSchema } from "../schema/define";
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
