import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { composeFile, parseFile } from "../front-matter";
import { pullTarget } from "../inbound";
import { pushPayload, webhookSignature } from "../testing";
import { closeGlobalPool, createHarness, type Harness, WEBHOOK_SECRET } from "./harness";

let h: Harness;

beforeAll(async () => {
	h = await createHarness();
});
afterAll(async () => {
	await h.close();
	await closeGlobalPool();
});

const WEBHOOK = "http://localhost/api/cms/v1/git-sync/webhook";

const hook = (body: string, headers: Record<string, string> = {}) =>
	h.cms.handle(
		new Request(WEBHOOK, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-github-event": "push",
				"x-hub-signature-256": webhookSignature(WEBHOOK_SECRET, body),
				...headers,
			},
			body,
		}),
	);

const push = () => hook(pushPayload("acme/site", "main"));

const publishMemo = (slug: string, title = slug, body = `Body of ${title}`) =>
	h.service.createDraft(
		{ collection: "memo", slug, metadata: { title }, body, format: "mdx" },
		{ publishImmediately: true },
	);

/** An edit made in git: the file's text changes on the branch. */
const editInGit = (path: string, change: (text: string) => string) => {
	const text = h.repo.files("main").get(path);
	if (text === undefined) throw new Error(`no file ${path}`);
	return h.repo.commit("main", [{ path, text: change(text) }]);
};

const publishedOf = async (collection: string, slug: string, locale = "en") => {
	const found = await h.store.getPublishedEntryBySlug({ collection, slug, locale, includeBody: false });
	return found.status === "current" ? await h.store.getEntry(found.entry.id) : null;
};

describe("the push webhook", () => {
	it("refuses a request whose signature does not match, and pulls nothing", async () => {
		h.github.calls.length = 0;
		const response = await hook(pushPayload("acme/site", "main"), { "x-hub-signature-256": "sha256=deadbeef" });
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: "invalid_signature" });
		expect(h.github.calls).toEqual([]);
		// No signature at all is refused as well.
		const bare = await h.cms.handle(new Request(WEBHOOK, { method: "POST", body: pushPayload("acme/site", "main") }));
		expect(bare.status).toBe(401);
	});

	it("says it is not set up when no webhook secret is saved", async () => {
		const bare = await createHarness({ noSettings: true });
		try {
			const body = pushPayload("acme/site", "main");
			const response = await bare.cms.handle(
				new Request(WEBHOOK, {
					method: "POST",
					headers: { "x-github-event": "push", "x-hub-signature-256": webhookSignature("anything", body) },
					body,
				}),
			);
			expect(response.status).toBe(503);
		} finally {
			await bare.close();
		}
	});

	it("answers a ping, and ignores events and branches no target follows", async () => {
		expect((await hook("{}", { "x-github-event": "ping" })).status).toBe(200);
		const other = await hook(pushPayload("acme/site", "feature"));
		expect(other.status).toBe(202);
		const stranger = await hook(pushPayload("someone/else", "main"));
		expect(stranger.status).toBe(202);
		expect((await hook("{}", { "x-github-event": "issues" })).status).toBe(202);
	});

	it("pulls the targets of the repo and branch the push is for", async () => {
		const response = await push();
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ ok: true, pulled: [{ target: "site", summary: { errors: [] } }] });
	});
});

describe("a change in git reaches the CMS", () => {
	it("writes an edited file to the entry through the pipeline and publishes it, without pushing anything back", async () => {
		const entry = await publishMemo("imp-edit", "Before", "old body");
		const path = "content/memo/imp-edit.en.mdx";
		editInGit(path, (text) => text.replace("title: Before", "title: After").replace("old body", "new body"));
		const head = h.repo.branches.get("main");
		h.github.calls.length = 0;

		const response = await push();
		expect(response.status).toBe(200);

		const after = await h.store.getEntry(entry.id);
		expect(after.published?.metadata).toMatchObject({ title: "After" });
		expect(after.working.metadata).toMatchObject({ title: "After" });
		expect(after.status).toBe("published");
		const { exportBodyText } = await import("@monti-cms/core/plugin/server");
		const { text } = await exportBodyText(h.cms, {
			format: "mdx",
			doc: after.published?.doc ?? after.working.doc,
			locale: "en",
		});
		expect(text.trim()).toBe("new body");

		// The import caused a publish; it is not committed back to the repo.
		expect(h.repo.branches.get("main")).toBe(head);
		expect(h.github.calls).not.toContain("createCommit");
		const record = await h.ctx.state.records.get("site", entry.id);
		expect(record).toMatchObject({
			path,
			blobSha: h.repo.treeOf("main").get(path),
			baseSha: h.repo.treeOf("main").get(path),
			contentHash: after.published?.contentHash,
		});
		expect(await h.ctx.state.queue.list("site")).toEqual([]);
	});

	it("does nothing when the files are what was last synced", async () => {
		await publishMemo("imp-same");
		const head = h.repo.branches.get("main");
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary).toMatchObject({ applied: 0, created: 0, conflicts: 0, errors: [] });
		expect(summary.unchanged).toBeGreaterThan(0);
		expect(h.repo.branches.get("main")).toBe(head);
	});

	it("creates and publishes an entry for a new file", async () => {
		const path = "content/memo/from-git.en.mdx";
		h.repo.commit("main", [{ path, text: composeFile({ title: "From git", slug: "from-git" }, "Hello from git\n") }]);
		const head = h.repo.branches.get("main");
		await push();
		const entry = await publishedOf("memo", "from-git");
		expect(entry).toMatchObject({ status: "published", publishedSlug: "from-git" });
		expect(entry?.published?.metadata).toMatchObject({ title: "From git" });
		expect(await h.ctx.state.records.get("site", entry?.id ?? "")).toMatchObject({ path, slug: "from-git" });
		// The file is left as the person wrote it.
		expect(h.repo.branches.get("main")).toBe(head);
	});

	it("takes the collection, language and slug from the path when the front matter has none", async () => {
		h.repo.commit("main", [
			{ path: "content/memo/path-only.en.mdx", text: composeFile({ title: "Path only" }, "text\n") },
		]);
		await push();
		expect(await publishedOf("memo", "path-only")).toMatchObject({ collection: "memo", locale: "en" });
	});

	it("creates a translation from a file that names its source, and publishes it", async () => {
		const source = await h.service.createDraft(
			{
				collection: "post",
				slug: "tr-source",
				metadata: { title: "Source", summary: "s" },
				body: "source text",
				format: "mdx",
			},
			{ publishImmediately: true },
		);
		const path = "content/post/tr-source.ko.mdx";
		h.repo.commit("main", [
			{
				path,
				text: composeFile(
					{
						title: "번역",
						slug: "tr-source",
						monti: {
							id: "00000000-0000-4000-8000-000000000999",
							collection: "post",
							locale: "ko",
							translationOf: source.id,
						},
					},
					"번역 본문\n",
				),
			},
		]);
		const response = await push();
		expect(await response.json()).toMatchObject({ pulled: [{ summary: { errors: [], created: 1 } }] });
		const translation = await publishedOf("post", "tr-source", "ko");
		expect(translation).toMatchObject({ locale: "ko", translationGroupId: source.id, status: "published" });
	});

	it("reports a file it cannot apply and still applies the others", async () => {
		const good = "content/memo/many-good.en.mdx";
		h.repo.commit("main", [
			{ path: "content/memo/broken-yaml.en.mdx", text: "---\ntitle: [unclosed\n---\n\nbody\n" },
			{
				path: "content/memo/unknown-field.en.mdx",
				text: composeFile({ title: "Unknown", slug: "unknown-field", nonsense: "x" }, "t\n"),
			},
			{ path: good, text: composeFile({ title: "Many good", slug: "many-good" }, "ok\n") },
			{ path: "content/memo/no-title.en.mdx", text: composeFile({ slug: "no-title" }, "t\n") },
		]);
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.errors.map((error) => error.path).sort()).toEqual([
			"content/memo/broken-yaml.en.mdx",
			"content/memo/no-title.en.mdx",
			"content/memo/unknown-field.en.mdx",
		]);
		expect(summary.errors.find((error) => error.path.includes("broken-yaml"))?.message).toMatch(
			/front matter is not valid YAML/,
		);
		expect(summary.errors.find((error) => error.path.includes("unknown-field"))?.message).toMatch(
			/invalid_metadata_key/,
		);
		expect(await publishedOf("memo", "many-good")).not.toBeNull();
		expect(await publishedOf("memo", "unknown-field")).toBeNull();
		// The files that cannot be applied are tried again by every pull; the next tests start without them.
		h.repo.commit(
			"main",
			summary.errors.map((error) => ({ path: error.path, delete: true as const })),
		);
	});

	it("ignores files outside the folder and files the path pattern does not produce", async () => {
		h.repo.commit("main", [
			{ path: "docs/memo/outside.en.mdx", text: composeFile({ title: "Outside", slug: "outside" }, "t\n") },
			{ path: "content/memo/notes.txt", text: "just notes" },
			{ path: "content/other/thing.en.mdx", text: composeFile({ title: "Other", slug: "thing" }, "t\n") },
		]);
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.errors).toEqual([]);
		expect(await publishedOf("memo", "outside")).toBeNull();
	});

	it("pairs a file that was moved in git with its entry by id (no second entry), and the entry's own path wins", async () => {
		const entry = await publishMemo("move-me", "Move me");
		const from = "content/memo/move-me.en.mdx";
		const text = h.repo.files("main").get(from) ?? "";
		h.repo.commit("main", [
			{ path: from, delete: true },
			{ path: "content/memo/moved.en.mdx", text },
		]);
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.errors).toEqual([]);
		expect(await publishedOf("memo", "moved")).toBeNull();
		expect((await h.store.getEntry(entry.id)).publishedSlug).toBe("move-me");
		// The path follows the slug (it is what the target's path pattern says), so the file is put back where the entry's address says it goes.
		expect(h.repo.files("main").has(from)).toBe(true);
		expect(h.repo.files("main").has("content/memo/moved.en.mdx")).toBe(false);
		expect(await h.ctx.state.records.get("site", entry.id)).toMatchObject({ path: from });
	});

	it("renames the file to follow a slug changed in the front matter", async () => {
		const entry = await publishMemo("slug-in-git", "Slug in git");
		const from = "content/memo/slug-in-git.en.mdx";
		editInGit(from, (text) => text.replace("slug: slug-in-git", "slug: slug-from-git"));
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.errors).toEqual([]);
		expect((await h.store.getEntry(entry.id)).publishedSlug).toBe("slug-from-git");
		expect(h.repo.files("main").has(from)).toBe(false);
		expect(h.repo.files("main").has("content/memo/slug-from-git.en.mdx")).toBe(true);
	});

	it("leaves the entry published when its file is deleted in git, and writes the file again on the next publish", async () => {
		const entry = await publishMemo("deleted-in-git", "Deleted in git");
		const path = "content/memo/deleted-in-git.en.mdx";
		h.repo.commit("main", [{ path, delete: true }]);
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.skipped.find((item) => item.path === path)?.reason).toMatch(/removed in git/);
		expect((await h.store.getEntry(entry.id)).status).toBe("published");

		const current = await h.store.getEntry(entry.id);
		const saved = await h.service.saveDraft(
			entry.id,
			{
				collection: "memo",
				slug: "deleted-in-git",
				metadata: { title: "Deleted in git 2" },
				body: "again",
				format: "mdx",
				expectedVersion: current.version,
			},
			{ publishImmediately: false },
		);
		await h.service.publish({ id: entry.id, expectedVersion: saved.version });
		expect(h.repo.files("main").has(path)).toBe(true);
	});

	it("takes a pull from the command line the same way as the webhook", async () => {
		const { commands } = await import("../commands");
		const lines: string[] = [];
		h.repo.commit("main", [
			{ path: "content/memo/by-command.en.mdx", text: composeFile({ title: "By command", slug: "by-command" }, "t\n") },
		]);
		const code = await commands.pull?.run({
			cms: h.cms,
			args: {},
			log: (line) => lines.push(line),
			error: () => undefined,
		});
		expect(code).toBe(0);
		expect(lines.join("\n")).toMatch(/site \(acme\/site@main\): 1 created/);
		expect(await publishedOf("memo", "by-command")).not.toBeNull();
	});
});

describe("round trip", () => {
	it("imports exactly what it exported: fields, relations by id and the body come back unchanged", async () => {
		const tag = await h.service.createDraft(
			{
				collection: "tag",
				slug: "rt-tag",
				metadata: { title: "Round trip tag", translations: { ko: { title: "태그" } } },
				body: "",
				format: "mdx",
			},
			{ publishImmediately: true },
		);
		const target = await h.service.createDraft(
			{ collection: "memo", slug: "rt-target", metadata: { title: "Target" }, body: "linked", format: "mdx" },
			{ publishImmediately: true },
		);
		const body = [
			"## Heading",
			"",
			"A paragraph with **bold**, `code` and a [link to another entry](/memos/rt-target).",
			"",
			"- one",
			"- two",
			"",
			"```ts",
			"const x = 1;",
			"```",
		].join("\n");
		const entry = await h.service.createDraft(
			{
				collection: "post",
				slug: "rt-post",
				metadata: {
					title: "Round trip: a title with colon & 'quotes'",
					summary: "Line one\nLine two",
					tagIds: [tag.id],
				},
				body,
				format: "mdx",
			},
			{ publishImmediately: true },
		);
		const before = await h.store.getEntry(entry.id);
		const path = "content/post/rt-post.en.mdx";
		const text = h.repo.files("main").get(path) ?? "";

		// The file says the entry: fields as keys, the relation as a list of ids, the link as the real path of its target.
		const parsed = parseFile(text);
		expect(parsed.ok && parsed.data).toMatchObject({
			title: "Round trip: a title with colon & 'quotes'",
			summary: "Line one\nLine two",
			// What a site's templates use: the slug of the tag. The exact id is under `monti.refs`.
			tagIds: ["rt-tag"],
			slug: "rt-post",
			monti: { id: entry.id, collection: "post", locale: "en", refs: { tagIds: [tag.id] } },
		});
		expect(parsed.ok && parsed.body).toContain("(/memos/rt-target)");

		// An edit that changes nothing the entry holds (only the dates, which are for the site) is applied as the same content.
		editInGit(path, (current) => current.replace(/lastmod: .*/, "lastmod: 2020-01-01T00:00:00.000Z"));
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.errors).toEqual([]);
		const after = await h.store.getEntry(entry.id);
		expect(after.published?.contentHash).toBe(before.published?.contentHash);
		expect(after.published?.metadata).toEqual(before.published?.metadata);
		expect(after.published?.doc).toEqual(before.published?.doc);
		expect(target.id).toBeDefined();
	});

	describe("relations are slugs in the file, ids in the entry", () => {
		const tagOf = (slug: string, title = slug) =>
			h.service.createDraft(
				{ collection: "tag", slug, metadata: { title }, body: "", format: "mdx" },
				{ publishImmediately: true },
			);
		const postWith = (slug: string, tagIds: string[]) =>
			h.service.createDraft(
				{ collection: "post", slug, metadata: { title: slug, tagIds }, body: "body", format: "mdx" },
				{ publishImmediately: true },
			);
		const path = (slug: string) => `content/post/${slug}.en.mdx`;

		it("writes the slugs a site needs and the exact ids under monti.refs, for a list and for a single relation", async () => {
			const one = await tagOf("rel-one");
			const two = await tagOf("rel-two");
			const post = await postWith("rel-list", [one.id, two.id]);
			const parsed = parseFile(h.repo.files("main").get(path("rel-list")) ?? "");
			expect(parsed.ok && parsed.data).toMatchObject({
				tagIds: ["rel-one", "rel-two"],
				monti: { id: post.id, refs: { tagIds: [one.id, two.id] } },
			});
		});

		it("uses monti.refs when the slugs are still what they were, so a body edit keeps the exact ids and the same hash", async () => {
			const one = await tagOf("ref-one");
			const post = await postWith("ref-post", [one.id]);
			const before = await h.store.getEntry(post.id);
			editInGit(path("ref-post"), (text) => text.replace("body", "a longer body"));
			expect((await pullTarget(h.ctx, h.target)).errors).toEqual([]);
			const after = await h.store.getEntry(post.id);
			expect(after.published?.metadata).toMatchObject({ tagIds: [one.id] });
			expect(after.published?.contentHash).not.toBe(before.published?.contentHash);
			// Only the body changed.
			expect(after.published?.metadata).toEqual(before.published?.metadata);
		});

		it("still finds a target that was renamed after the file was written, by its exact id", async () => {
			const tag = await tagOf("before-rename", "Tag");
			const post = await postWith("renamed-target", [tag.id]);
			const current = await h.store.getEntry(tag.id);
			await h.service.saveDraft(
				tag.id,
				{
					collection: "tag",
					slug: "after-rename",
					metadata: { title: "Tag" },
					body: "",
					format: "mdx",
					expectedVersion: current.version,
				},
				{ publishImmediately: true },
			);
			// The post's file still says the old slug; its refs say which entry it is.
			expect(parseFile(h.repo.files("main").get(path("renamed-target")) ?? "")).toMatchObject({
				data: { tagIds: ["before-rename"] },
			});
			editInGit(path("renamed-target"), (text) => text.replace("body", "edited body"));
			expect((await pullTarget(h.ctx, h.target)).errors).toEqual([]);
			expect((await h.store.getEntry(post.id)).published?.metadata).toMatchObject({ tagIds: [tag.id] });
		});

		it("resolves slugs written by hand, when the file has no monti.refs or the slugs were edited", async () => {
			const red = await tagOf("hand-red");
			const blue = await tagOf("hand-blue");
			const post = await postWith("hand-post", [red.id]);
			// Slugs edited in git: refs no longer match, the slugs win.
			editInGit(path("hand-post"), (text) => text.replace("- hand-red", "- hand-blue"));
			expect((await pullTarget(h.ctx, h.target)).errors).toEqual([]);
			expect((await h.store.getEntry(post.id)).published?.metadata).toMatchObject({ tagIds: [blue.id] });

			// A new file with no monti block at all.
			h.repo.commit("main", [
				{
					path: path("by-hand"),
					text: composeFile({ title: "By hand", slug: "by-hand", tagIds: ["hand-red", "hand-blue"] }, "text\n"),
				},
			]);
			expect((await pullTarget(h.ctx, h.target)).errors).toEqual([]);
			const created = await publishedOf("post", "by-hand");
			expect(created?.published?.metadata).toMatchObject({ tagIds: [red.id, blue.id] });
		});

		it("reports a slug no entry has, naming the field and the slug, and writes nothing", async () => {
			h.repo.commit("main", [
				{
					path: path("bad-slug"),
					text: composeFile({ title: "Bad slug", slug: "bad-slug", tagIds: ["nope-tag"] }, "text\n"),
				},
			]);
			const summary = await pullTarget(h.ctx, h.target);
			expect(summary.errors).toEqual([
				{ path: path("bad-slug"), message: 'relations: field tagIds: no tag has the slug "nope-tag"' },
			]);
			expect(await publishedOf("post", "bad-slug")).toBeNull();
			h.repo.commit("main", [{ path: path("bad-slug"), delete: true }]);
		});
	});

	it("round trips the per-language names of an item collection", async () => {
		const tag = await h.service.createDraft(
			{
				collection: "tag",
				slug: "rt-names",
				metadata: { title: "Names", translations: { ko: { title: "이름" } } },
				body: "",
				format: "mdx",
			},
			{ publishImmediately: true },
		);
		const before = await h.store.getEntry(tag.id);
		const path = "content/tag/rt-names.en.mdx";
		expect(parseFile(h.repo.files("main").get(path) ?? "")).toMatchObject({
			ok: true,
			data: { translations: { ko: { title: "이름" } } },
		});
		editInGit(path, (text) => text.replace(/lastmod: .*/, "lastmod: 2020-01-01T00:00:00.000Z"));
		await pullTarget(h.ctx, h.target);
		const after = await h.store.getEntry(tag.id);
		expect(after.published?.contentHash).toBe(before.published?.contentHash);
	});
});
