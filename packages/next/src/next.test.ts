import type { Monti, MontiEvent, SiteEntry, SiteReader } from "@monti-cms/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Next's own functions, replaced by stand-ins that write down what was asked: the real ones need a Next request around them. The example app's
// flows try the real ones (testing/e2e).
const next = vi.hoisted(() => ({
	draft: false,
	cookies: new Map<string, string>(),
	set: [] as { name: string; value: string; options: Record<string, unknown> }[],
	revalidated: [] as unknown[][],
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
const core = vi.hoisted(() => ({
	good: "good-ticket",
	sync: { status: "same" } as Record<string, unknown>,
	calls: [] as string[],
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
	openMonti: () => ({}),
}));

const { entryPage, previewPage } = await import("./page");
const { adminRoute, localPath, PREVIEW_COOKIE, startUp } = await import("./route");
const { cacheReceiver, isDevServer } = await import("./site");

const monti = { site: { secret: "secret" }, now: () => new Date("2026-11-12T00:00:00Z") } as unknown as Monti;
const get = (route: ReturnType<typeof adminRoute>, url: string, headers: Record<string, string> = {}) =>
	route.GET(new Request(url, { headers }));

beforeEach(() => {
	next.draft = false;
	next.cookies.clear();
	next.set = [];
	next.revalidated = [];
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
		for (const path of ["https://evil.test/", "//evil.test", "/\\evil.test", "posts/hello", ""]) {
			const answer = await get(
				adminRoute(monti),
				`https://site.test/admin/api/preview?token=${core.good}&path=${encodeURIComponent(path)}`,
			);
			expect(answer.status).toBe(400);
		}
		expect(next.draft).toBe(false);
		expect(localPath("/posts/hello?x=1")).toBe("/posts/hello?x=1");
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
	it("16-3 a change the site shows refreshes every cached page; a save alone refreshes nothing", async () => {
		const event = (type: string): MontiEvent => ({ type, ids: ["e1"] });
		expect(
			["entry.published", "entry.unpublished", "media.replaced", "media.trashed", "media.restored"].map((type) =>
				cacheReceiver.accepts?.(event(type)),
			),
		).toEqual([true, true, true, true, true]);
		expect(["entry.saved", "media.uploaded"].map((type) => cacheReceiver.accepts?.(event(type)))).toEqual([
			false,
			false,
		]);
		await cacheReceiver.send(event("entry.published"));
		expect(next.revalidated).toEqual([["/", "layout"]]);
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
