import type { Monti, MontiEvent, SiteEntry, SiteReader } from "@monti-cms/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** When an event of these tests was emitted, and the signal a sender passes with it. */
const AT = "2026-11-12T00:00:00.000Z";
const signal = new AbortController().signal;

// Next's own functions, replaced by stand-ins that write down what was asked: the real ones need a Next request around them. The example app's
// flows try the real ones (testing/e2e).
const next = vi.hoisted(() => ({
	draft: false,
	cookies: new Map<string, string>(),
	set: [] as { name: string; value: string; options: Record<string, unknown> }[],
	revalidated: [] as unknown[][],
	later: [] as (() => Promise<void>)[],
}));
class NotFound extends Error {}
class Redirect extends Error {
	constructor(readonly to: string) {
		super(to);
	}
}
vi.mock("next/headers", () => ({
	draftMode: async () => ({
		get isEnabled() {
			return next.draft;
		},
		enable: () => {
			next.draft = true;
		},
		disable: () => {
			next.draft = false;
		},
	}),
	cookies: async () => ({
		get: (name: string) => (next.cookies.has(name) ? { name, value: next.cookies.get(name) } : undefined),
		set: (name: string, value: string, options: Record<string, unknown>) => {
			next.cookies.set(name, value);
			next.set.push({ name, value, options });
		},
		delete: (name: string) => {
			next.cookies.delete(name);
		},
	}),
}));
vi.mock("next/navigation", () => ({
	notFound: () => {
		throw new NotFound();
	},
	permanentRedirect: (to: string) => {
		throw new Redirect(to);
	},
}));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => void next.revalidated.push(args) }));
// `after`: what a route does once its answer is sent. Kept here, to be run by the test.
vi.mock("next/server", () => ({ after: (later: () => Promise<void>) => void next.later.push(later) }));
const core = vi.hoisted(() => ({
	good: "good-ticket",
	sync: { status: "same" } as Record<string, unknown>,
	calls: [] as string[],
	pools: 0,
	opened: [] as { db: unknown; config: unknown }[],
}));
vi.mock("@monti-cms/core", () => ({
	createAdminApi: () => async (request: Request) => {
		core.calls.push(`${request.method} ${new URL(request.url).pathname}`);
		return new Response("api");
	},
	readPreviewToken: async (_secret: string, token: string) => (token === core.good ? "entry-1" : null),
	syncSchemaFile: async () => {
		if (core.sync.status === "throw") throw new Error("relation does not exist");
		return core.sync;
	},
	createReader: () => ({}),
	openMonti: (config: unknown, root: string, reuse: { db?: unknown }) => {
		const monti = {
			db: reuse.db ?? { pool: ++core.pools },
			site: { schema: () => ({}), secret: null, storage: null },
			config,
			root,
		};
		core.opened.push(monti);
		return monti;
	},
}));

const { entryPage, previewPage } = await import("./page");
const { adminRoute, localPath, PREVIEW_COOKIE, startUp } = await import("./route");
const { cacheReceiver, isDevServer, openSite } = await import("./site");
const { isLoopback, loopbackProof } = await import("./dev-proof");

const monti = { site: { secret: "secret" }, now: () => new Date("2026-11-12T00:00:00Z") } as unknown as Monti;
const get = (route: ReturnType<typeof adminRoute>, url: string, headers: Record<string, string> = {}) =>
	route.GET(new Request(url, { headers }));

beforeEach(() => {
	next.draft = false;
	next.cookies.clear();
	next.set = [];
	next.revalidated = [];
	next.later = [];
	core.sync = { status: "same" };
	core.calls = [];
});

describe("turning the preview on and off", () => {
	it("16-2 a good ticket turns draft mode on, keeps the ticket in a cookie the page cannot read from script, and goes to the entry's page", async () => {
		const answer = await get(
			adminRoute(monti),
			`https://site.test/admin/api/preview?token=${core.good}&path=/posts/hello`,
		);
		expect([answer.status, answer.headers.get("location")]).toEqual([307, "/posts/hello"]);
		expect(next.draft).toBe(true);
		expect(next.set).toEqual([
			{
				name: PREVIEW_COOKIE,
				value: core.good,
				options: { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 3600 },
			},
		]);
	});

	it("16-2 a forged or ended ticket, or no ticket, turns nothing on", async () => {
		for (const query of ["token=forged&path=/posts/hello", "path=/posts/hello"]) {
			const answer = await get(adminRoute(monti), `https://site.test/admin/api/preview?${query}`);
			expect(answer.status).toBe(401);
		}
		expect(next.draft).toBe(false);
		expect(next.set).toEqual([]);
	});

	it("16-2 the preview never sends the browser off the site", async () => {
		for (const path of [
			"https://evil.test/",
			"//evil.test",
			"/\\evil.test",
			"posts/hello",
			"",
			// A browser drops a tab or a line break before it reads the address: `/\t/evil.test` is `//evil.test`.
			"/\t/evil.test",
			"/\n/evil.test",
			"/ /evil.test",
			// Lands on this site, but is written back as `//evil.test`.
			"/.//evil.test",
		]) {
			const answer = await get(
				adminRoute(monti),
				`https://site.test/admin/api/preview?token=${core.good}&path=${encodeURIComponent(path)}`,
			);
			expect(answer.status).toBe(400);
		}
		expect(next.draft).toBe(false);
		expect(localPath("/posts/hello?x=1")).toBe("/posts/hello?x=1");
		// A Korean slug goes as a header can carry it.
		expect(localPath("/posts/한글-글")).toBe("/posts/%ED%95%9C%EA%B8%80-%EA%B8%80");
	});

	it("16-2 exit turns draft mode off, drops the ticket and goes back to the page that was open, on this site only", async () => {
		next.draft = true;
		next.cookies.set(PREVIEW_COOKIE, core.good);
		const route = adminRoute(monti);
		const back = await get(route, "https://site.test/admin/api/preview/exit", {
			referer: "https://site.test/posts/hello?x=1",
		});
		expect([back.status, back.headers.get("location")]).toEqual([307, "/posts/hello?x=1"]);
		expect(next.draft).toBe(false);
		expect(next.cookies.has(PREVIEW_COOKIE)).toBe(false);
		const elsewhere = await get(route, "https://site.test/admin/api/preview/exit", { referer: "https://evil.test/x" });
		expect(elsewhere.headers.get("location")).toBe("/");
		// The way out takes no ticket, so its `path` is checked as the way in's is.
		for (const path of ["/\t/evil.test", "//evil.test", "https://evil.test/", "/.//evil.test"]) {
			const away = await get(route, `https://site.test/admin/api/preview/exit?path=${encodeURIComponent(path)}`);
			expect(away.headers.get("location")).toBe("/");
		}
	});

	it("16-1 everything else is the core's admin API", async () => {
		const route = adminRoute(monti);
		await route.POST(
			new Request("https://site.test/admin/api/operations/frame.counts", { method: "POST", body: "{}" }),
		);
		await get(route, "https://site.test/admin/api/media/files/a.png");
		expect(core.calls).toEqual(["POST /admin/api/operations/frame.counts", "GET /admin/api/media/files/a.png"]);
	});
});

describe("what the server says when the admin API is first called", () => {
	const said = async (sync: Record<string, unknown>) => {
		core.sync = sync;
		const lines: string[] = [];
		await startUp(monti, (line) => lines.push(line));
		return lines;
	};

	it("16-4 the dev server says it followed a changed schema file, or that the change waits for a review; an unchanged one says nothing", async () => {
		expect(await said({ status: "same" })).toEqual([]);
		expect(await said({ status: "applied", changeId: "0007_add-field" })).toEqual([
			"Monti: the schema file changed; the database follows it now (0007_add-field).",
		]);
		expect((await said({ status: "review", changes: [] }))[0]).toContain("Review it in the admin's settings");
	});

	it("16-4 the live site only says what to run: db:migrate when the database is behind, db:setup when it is new", async () => {
		expect(await said({ status: "migrate" })).toEqual([
			"Monti: the database is behind the schema. Run `monti db:migrate`.",
		]);
		expect((await said({ status: "fresh" }))[0]).toContain("monti db:setup");
		expect((await said({ status: "throw" }))[0]).toContain("monti db:setup");
	});

	it("16-4 it is said once, however many requests come", async () => {
		core.sync = { status: "migrate" };
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const route = adminRoute(monti);
		await Promise.all([1, 2, 3].map(() => get(route, "https://site.test/admin/api/media/files/a.png")));
		expect(log).toHaveBeenCalledTimes(1);
		log.mockRestore();
	});
});

describe("reading an entry for a page", () => {
	const entry = (over: Partial<SiteEntry> = {}): SiteEntry => ({
		id: "e1",
		collection: "post",
		locale: "ko",
		title: "글",
		slug: "hello",
		path: "/posts/hello",
		values: {},
		doc: { type: "doc", blocks: [] },
		publishedAt: new Date("2026-11-01T00:00:00Z"),
		...over,
	});
	const asked: unknown[] = [];
	const reader = (answer: Awaited<ReturnType<SiteReader["entry"]>>) =>
		({
			locales: () => ({ source: "ko", list: [], prefix: "exceptSource" }),
			entry: async (where: unknown) => {
				asked.push(where);
				return answer;
			},
			linkPaths: async () => ({ g1: "/posts/other" }),
		}) as unknown as SiteReader;
	beforeEach(() => {
		asked.length = 0;
	});

	it("16-7 a page gets its entry in the source language unless it names another, with the paths its links go to; the slug is read as the address has it", async () => {
		const page = await entryPage(reader({ entry: entry() }), { collection: "post", slug: "%EA%B8%80" });
		expect(asked).toEqual([{ collection: "post", slug: "글", locale: "ko", preview: undefined }]);
		expect([page.title, page.preview, page.entryPath("g1"), page.entryPath("none")]).toEqual([
			"글",
			false,
			"/posts/other",
			undefined,
		]);
		await entryPage(reader({ entry: entry() }), { collection: "post", slug: "hello", locale: "en" });
		expect(asked[1]).toMatchObject({ locale: "en" });
	});

	it("16-7 no entry is not found, and an old address goes to the new one for good", async () => {
		await expect(entryPage(reader(null), { collection: "post", slug: "x" })).rejects.toBeInstanceOf(NotFound);
		await expect(
			entryPage(reader({ redirect: "/posts/new" }), { collection: "post", slug: "old" }),
		).rejects.toMatchObject({
			to: "/posts/new",
		});
	});

	it("16-2 the ticket is read only while draft mode is on, and the working copy it opens is marked as the preview", async () => {
		next.cookies.set(PREVIEW_COOKIE, core.good);
		await entryPage(reader({ entry: entry() }), { collection: "post", slug: "hello" });
		expect(asked[0]).toMatchObject({ preview: undefined });
		next.draft = true;
		const page = await entryPage(reader({ entry: entry({ publishedAt: null }) }), {
			collection: "post",
			slug: "hello",
		});
		expect(asked[1]).toMatchObject({ preview: core.good });
		expect(page.preview).toBe(true);
		// With the ticket of another entry, this page is what the site shows.
		expect((await entryPage(reader({ entry: entry() }), { collection: "post", slug: "hello" })).preview).toBe(false);
	});

	it("16-9 the site's own preview page shows the working copy to the one who opened its preview, and is not found otherwise", async () => {
		await expect(previewPage(reader({ entry: entry() }), { collection: "post", slug: "hello" })).rejects.toBeInstanceOf(
			NotFound,
		);
		next.draft = true;
		next.cookies.set(PREVIEW_COOKIE, core.good);
		// A ticket of another entry: the reader gives what is published, which never shows on a preview page.
		await expect(previewPage(reader({ entry: entry() }), { collection: "post", slug: "hello" })).rejects.toBeInstanceOf(
			NotFound,
		);
		await expect(previewPage(reader(null), { collection: "post", slug: "hello" })).rejects.toBeInstanceOf(NotFound);
		const page = await previewPage(reader({ entry: entry({ publishedAt: null }) }), {
			collection: "post",
			slug: "hello",
		});
		expect(page.preview).toBe(true);
	});
});

describe("the site's cache and which server this is", () => {
	it("16-3 a change the site shows refreshes every cached page; a save alone, a new file and the admin's own values refresh nothing; an event nobody knows refreshes", async () => {
		const event = (type: string): MontiEvent => ({ type, at: AT, ids: ["e1"] });
		const shown = [
			"entry.published",
			"entry.unpublished",
			"media.replaced",
			"media.renamed",
			"media.trashed",
			"media.restored",
		];
		expect(shown.filter((type) => !cacheReceiver.accepts?.(event(type)))).toEqual([]);
		expect(
			["entry.saved", "media.uploaded", "settings.saved"].filter((type) => cacheReceiver.accepts?.(event(type))),
		).toEqual([]);
		// A later feature's event is not one of the two that are safe to skip.
		expect(cacheReceiver.accepts?.(event("schema.applied"))).toBe(true);
		await cacheReceiver.send(event("entry.published"), signal);
		expect(next.revalidated).toEqual([["/", "layout"]]);
	});

	it("16-3 the pages are marked once more two seconds after the answer is sent: a page that was being drawn while the change was made is not kept", async () => {
		vi.useFakeTimers();
		try {
			await cacheReceiver.send({ type: "entry.unpublished", at: AT, ids: ["e1"] }, signal);
			expect(next.revalidated).toHaveLength(1);
			// After the answer: nothing more yet, then the second mark.
			const [later] = next.later;
			const running = later?.();
			await vi.advanceTimersByTimeAsync(1900);
			expect(next.revalidated).toHaveLength(1);
			await vi.advanceTimersByTimeAsync(200);
			await running;
			expect(next.revalidated).toEqual([
				["/", "layout"],
				["/", "layout"],
			]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("16-4 the dev server is `next dev` with a schema file it can write; a build, a started site or a folder with no such file is the live site", async () => {
		const { mkdtempSync, writeFileSync, chmodSync } = await import("node:fs");
		const { tmpdir } = await import("node:os");
		const path = await import("node:path");
		const root = mkdtempSync(path.join(tmpdir(), "monti-next-"));
		expect(isDevServer(root, { NODE_ENV: "development" })).toBe(false);
		writeFileSync(path.join(root, "monti.schema.ts"), "export default {};");
		expect(isDevServer(root, { NODE_ENV: "development" })).toBe(true);
		expect(isDevServer(root, { NODE_ENV: "production" })).toBe(false);
		expect(isDevServer(root, {})).toBe(false);
		chmodSync(path.join(root, "monti.schema.ts"), 0o444);
		expect(isDevServer(root, { NODE_ENV: "development" })).toBe(false);
	});
});

describe("opening the site once, and again when its config changed", () => {
	it("16-4 the same config gives the same Monti; a changed config (the schema file edited, a setting changed) makes it again on the same database pool", () => {
		const first = { schema: { v: 1 }, database: "postgres://x", dev: false } as never;
		const one = openSite(first, { root: "/site" });
		expect(openSite(first, { root: "/site" })).toBe(one);
		expect(core.opened).toHaveLength(1);
		// The dev server evaluates the config again after an edit: another object.
		const edited = { schema: { v: 2 }, database: "postgres://x", dev: false } as never;
		const two = openSite(edited, { root: "/site" });
		expect(two).not.toBe(one);
		expect(core.opened).toHaveLength(2);
		expect((core.opened[1]?.config as { schema: unknown }).schema).toEqual({ v: 2 });
		// One pool of connections for the server's life.
		expect(core.opened[1]?.db).toBe(core.opened[0]?.db);
		expect(core.pools).toBe(1);
		// The live site brings no proof of a local browser; the dev server brings one.
		expect((core.opened[1]?.config as { devProof: unknown }).devProof).toBeNull();
		openSite({ schema: {}, database: "postgres://x", dev: true } as never, { root: "/site" });
		expect((core.opened[2]?.config as { devProof: unknown }).devProof).not.toBeNull();
	});
});

describe("the proof that a browser runs on this machine", () => {
	const listening = async (proof: ReturnType<typeof loopbackProof>) => {
		for (let tries = 0; proof.url() === null && tries < 100; tries++) await new Promise((done) => setTimeout(done, 10));
		const url = proof.url();
		if (!url) throw new Error("the listener did not come up");
		return url;
	};
	const ask = (url: string, headers: Record<string, string>, method = "GET") => fetch(url, { method, headers });

	it("16-5 a page of a local origin gets a ticket that is good once, for a minute; the listener is on the loopback address only", async () => {
		let now = 1_000_000;
		const proof = loopbackProof(() => now);
		const url = await listening(proof);
		expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
		const answer = await ask(url, { origin: "http://localhost:3000" });
		expect(answer.status).toBe(200);
		// Only the page that asked may read it.
		expect(answer.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
		const { ticket } = (await answer.json()) as { ticket: string };
		expect(ticket.length).toBeGreaterThan(20);
		expect(proof.take(ticket)).toBe(true);
		expect(proof.take(ticket)).toBe(false);
		expect(proof.take("made-up")).toBe(false);
		const late = ((await (await ask(url, { origin: "http://127.0.0.1:3000" })).json()) as { ticket: string }).ticket;
		now += 61_000;
		expect(proof.take(late)).toBe(false);
		proof.close();
	});

	it("16-5 a page of another site, a request with no origin and a name that only resolves to this machine get no ticket", async () => {
		const proof = loopbackProof();
		const url = await listening(proof);
		for (const headers of [
			{ origin: "https://evil.test" },
			{},
			{ origin: "http://localhost.evil.test" },
			{ origin: "null" },
		]) {
			const answer = await ask(url, headers as Record<string, string>);
			expect(answer.status).toBe(403);
			expect(answer.headers.get("access-control-allow-origin")).toBeNull();
			expect(await answer.text()).toBe("");
		}
		// DNS rebinding: the page's site is local by its origin's look, but the request names another host.
		expect(isLoopback("evil.test:49152", "host")).toBe(false);
		expect(isLoopback("127.0.0.1:49152", "host")).toBe(true);
		expect(isLoopback("http://[::1]:3000", "origin")).toBe(true);
		// A name under `localhost` is not trusted: a browser that asks the network for it can be sent elsewhere.
		expect(isLoopback("http://app.localhost:3000", "origin")).toBe(false);
		expect((await ask(url, { origin: "http://evil.localhost:3000" })).status).toBe(403);
		expect(isLoopback("file://localhost", "origin")).toBe(false);
		// The browser's question before it reaches a more private address is answered for a local page only.
		const asked = await ask(url, { origin: "http://localhost:3000" }, "OPTIONS");
		expect([asked.status, asked.headers.get("access-control-allow-private-network")]).toEqual([204, "true"]);
		expect((await ask(url, { origin: "http://localhost:3000" }, "POST")).status).toBe(405);
		proof.close();
	});
});

describe("the site decides how its pages are refreshed", () => {
	type Opened = {
		config: {
			receivers: {
				destination: string;
				accepts?: (event: MontiEvent) => boolean;
				send: (event: MontiEvent) => Promise<void>;
			}[];
		};
	};
	const receiversOf = (opened: unknown) => (opened as Opened).config.receivers;
	const config = () => ({ schema: {}, database: "postgres://x", dev: false }) as never;

	it("16-3 left alone, the adapter refreshes the whole site; with the site's own function that runs instead, for the same events; with false nothing is added", async () => {
		openSite(config(), { root: "/own" });
		const [standard] = receiversOf(core.opened.at(-1));
		await standard?.send({ type: "entry.published", at: AT, ids: ["e1"] });
		expect(next.revalidated).toEqual([["/", "layout"]]);

		const got: MontiEvent[] = [];
		openSite(config(), { root: "/own", refresh: (event) => void got.push(event) });
		const [own] = receiversOf(core.opened.at(-1));
		expect(own?.destination).toBe("plugin:next");
		// The site's function gets what a visitor would see change, and not a save alone.
		expect(own?.accepts?.({ type: "entry.saved", at: AT, ids: [] })).toBe(false);
		next.revalidated = [];
		await own?.send({ type: "entry.published", at: AT, ids: ["e1"], paths: ["/posts/a"] });
		expect(got).toEqual([{ type: "entry.published", at: AT, ids: ["e1"], paths: ["/posts/a"] }]);
		expect(next.revalidated).toEqual([]);

		openSite(config(), { root: "/own", refresh: false });
		expect(receiversOf(core.opened.at(-1))).toEqual([]);
	});
});
