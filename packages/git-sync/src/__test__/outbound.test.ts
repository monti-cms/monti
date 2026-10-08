import { parseFile } from "@monti-cms/core/front-matter";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { flushTarget } from "../outbound";
import { closeGlobalPool, createHarness, DEFAULT_TARGET, type Harness } from "./harness";

let h: Harness;

beforeAll(async () => {
	h = await createHarness();
});
afterAll(async () => {
	await h.close();
	await closeGlobalPool();
});
afterEach(() => {
	h.github.calls.length = 0;
});

const memo = (slug: string, title: string, text = `Body of ${title}`) =>
	h.service
		.createDraft(
			{ collection: "memo", slug, metadata: { title }, body: text, format: "mdx" },
			{ publishImmediately: true },
		)
		.then((result) => result.entry);

describe("publishing commits the file", () => {
	it("writes the entry as front matter and an MDX body in one commit on the branch", async () => {
		const entry = await memo("hello", "Hello", "Hello **world**");
		const files = h.repo.files("main");
		const text = files.get("content/memo/hello.en.mdx");
		expect(text).toBeDefined();
		const parsed = parseFile(text ?? "");
		expect(parsed).toMatchObject({
			ok: true,
			data: {
				title: "Hello",
				slug: "hello",
				monti: { id: entry.id, collection: "memo", locale: "en" },
			},
		});
		expect(parsed.ok && parsed.body.trim()).toBe("Hello **world**");
		expect(parsed.ok && typeof parsed.data.date).toBe("string");
		// One commit, on top of the seed commit.
		expect(h.github.calls.filter((call) => call === "createCommit")).toHaveLength(1);
		expect(h.repo.files("main").get("README.md")).toBe("# site\n");
	});

	it("records the file path, the git blob sha and the content hash per entry", async () => {
		const entry = await memo("recorded", "Recorded");
		const record = await h.ctx.state.records.get("site", entry.id);
		expect(record).toMatchObject({
			path: "content/memo/recorded.en.mdx",
			slug: "recorded",
			contentHash: entry.published?.contentHash,
			blobSha: expect.stringMatching(/^[0-9a-f]{40}$/),
		});
		expect(record?.blobSha).toBe(record?.baseSha);
		const tree = h.repo.treeOf("main");
		expect(tree.get("content/memo/recorded.en.mdx")).toBe(record?.blobSha);
	});

	it("does not commit again for a publish that changes nothing", async () => {
		await memo("same-twice", "Same twice");
		h.github.calls.length = 0;
		const entry = await h.store.getEntry((await h.ctx.state.records.list("site")).values().next().value?.entryId ?? "");
		expect(entry).toBeDefined();
		const before = h.repo.branches.get("main");
		await flushTarget(h.ctx, h.target);
		expect(h.repo.branches.get("main")).toBe(before);
	});

	it("ignores drafts and collections the target does not list", async () => {
		const before = h.repo.branches.get("main");
		await h.service.createDraft({
			collection: "memo",
			slug: "just-a-draft",
			metadata: { title: "Draft" },
			body: "x",
			format: "mdx",
		});
		expect(h.repo.branches.get("main")).toBe(before);
		expect(h.repo.files("main").has("content/memo/just-a-draft.en.mdx")).toBe(false);
	});

	it("writes the published version, not a newer draft", async () => {
		const entry = await memo("draft-after", "Published title");
		const saved = (
			await h.service.saveDraft(
				entry.id,
				{
					collection: "memo",
					slug: "draft-after",
					metadata: { title: "Draft title" },
					body: "draft text",
					format: "mdx",
					expectedVersion: entry.version,
				},
				{ publishImmediately: false },
			)
		).entry;
		expect(saved.version).toBeGreaterThan(entry.version);
		const text = h.repo.files("main").get("content/memo/draft-after.en.mdx") ?? "";
		expect(text).toContain("Published title");
		expect(text).not.toContain("Draft title");
	});
});

describe("republishing, renaming and removing", () => {
	it("updates the file when the entry is published again with changes", async () => {
		const entry = await memo("changing", "Changing", "first");
		const saved = (
			await h.service.saveDraft(
				entry.id,
				{
					collection: "memo",
					slug: "changing",
					metadata: { title: "Changing" },
					body: "second",
					format: "mdx",
					expectedVersion: entry.version,
				},
				{ publishImmediately: false },
			)
		).entry;
		await h.service.publish({ id: entry.id, expectedVersion: saved.version });
		const parsed = parseFile(h.repo.files("main").get("content/memo/changing.en.mdx") ?? "");
		expect(parsed.ok && parsed.body.trim()).toBe("second");
	});

	it("renames the file when the slug changes", async () => {
		const entry = await memo("old-name", "Renamed");
		const saved = (
			await h.service.saveDraft(
				entry.id,
				{
					collection: "memo",
					slug: "new-name",
					metadata: { title: "Renamed" },
					body: "Body of Renamed",
					format: "mdx",
					expectedVersion: entry.version,
				},
				{ publishImmediately: false },
			)
		).entry;
		await h.service.publish({ id: entry.id, expectedVersion: saved.version });
		const files = h.repo.files("main");
		expect(files.has("content/memo/old-name.en.mdx")).toBe(false);
		expect(files.has("content/memo/new-name.en.mdx")).toBe(true);
		const record = await h.ctx.state.records.get("site", entry.id);
		expect(record).toMatchObject({ path: "content/memo/new-name.en.mdx", slug: "new-name" });
	});

	it("deletes the file and the record when the entry is trashed, archived or deleted", async () => {
		const trashed = await memo("to-trash", "Trash me");
		const archived = await memo("to-archive", "Archive me");
		const deleted = await memo("to-delete", "Delete me");
		expect(h.repo.files("main").has("content/memo/to-trash.en.mdx")).toBe(true);

		await h.store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });
		await h.store.archiveEntry({ id: archived.id, expectedVersion: archived.version });
		const gone = await h.store.trashEntry({ id: deleted.id, expectedVersion: deleted.version });
		await h.store.permanentDeleteEntry({ id: deleted.id, expectedVersion: gone.version });

		const files = h.repo.files("main");
		for (const slug of ["to-trash", "to-archive", "to-delete"])
			expect(files.has(`content/memo/${slug}.en.mdx`)).toBe(false);
		for (const entry of [trashed, archived, deleted])
			expect(await h.ctx.state.records.get("site", entry.id)).toBeNull();
	});

	it("writes the file again when a trashed entry is restored", async () => {
		const entry = await memo("come-back", "Come back");
		const trashed = await h.store.trashEntry({ id: entry.id, expectedVersion: entry.version });
		expect(h.repo.files("main").has("content/memo/come-back.en.mdx")).toBe(false);
		await h.service.restore({ id: entry.id, expectedVersion: trashed.version });
		const restored = await h.store.getEntry(entry.id);
		if (restored.status !== "published")
			(await h.service.publish({ id: entry.id, expectedVersion: restored.version })).entry;
		expect(h.repo.files("main").has("content/memo/come-back.en.mdx")).toBe(true);
	});
});

describe("what a target syncs", () => {
	it("uses the target's folder, format and path pattern (a Hugo-style layout)", async () => {
		const hugo = await createHarness({
			targets: [{ ...DEFAULT_TARGET, folder: "", path: "content/{collection}/{slug}/index.{locale}.{ext}" }],
		});
		try {
			await hugo.service.createDraft(
				{ collection: "memo", slug: "hugo-post", metadata: { title: "Hugo" }, body: "text", format: "mdx" },
				{ publishImmediately: true },
			);
			expect([...hugo.repo.files("main").keys()].sort()).toEqual(["README.md", "content/memo/hugo-post/index.en.mdx"]);
		} finally {
			await hugo.close();
		}
	});

	it("keeps a different collection set per target", async () => {
		const two = await createHarness({
			targets: [{ ...DEFAULT_TARGET, collections: ["post"] }],
		});
		try {
			await two.service.createDraft(
				{ collection: "memo", slug: "not-synced", metadata: { title: "x" }, body: "x", format: "mdx" },
				{ publishImmediately: true },
			);
			expect([...two.repo.files("main").keys()]).toEqual(["README.md"]);
		} finally {
			await two.close();
		}
	});
});
