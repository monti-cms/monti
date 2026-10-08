import { defineCollection, fields } from "@monti-cms/core";
import { composeFile, parseFile } from "@monti-cms/core/front-matter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pushPayload, webhookSignature } from "../testing";
import { closeGlobalPool, createHarness, type Harness, WEBHOOK_SECRET } from "./harness";

/** A site whose notes keep the title in `headline` (`role: "title"`): the file still calls it `title`, and drafts and conflicts name entries by it. */
const note = defineCollection({
	label: "Note",
	kind: "document",
	path: "/notes/:slug",
	fields: {
		headline: fields.text({ label: "Headline", role: "title", required: true, max: 200 }),
		slug: fields.slug({ label: "Slug", from: "headline", required: true }),
		summary: fields.text({ label: "Summary", multiline: true }),
	},
});

let h: Harness;
beforeAll(async () => {
	h = await createHarness({
		collections: { note },
		targets: [
			{ id: "site", repo: "acme/site", branch: "main", folder: "content", collections: ["note"], drafts: true },
		],
	});
});
afterAll(async () => {
	await h.close();
	await closeGlobalPool();
});

const WEBHOOK = "http://localhost/api/cms/v1/git-sync/webhook";
const push = () => {
	const body = pushPayload("acme/site", "main");
	return h.cms.handle(
		new Request(WEBHOOK, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-github-event": "push",
				"x-hub-signature-256": webhookSignature(WEBHOOK_SECRET, body),
			},
			body,
		}),
	);
};

const publishNote = (slug: string, headline: string, summary?: string) =>
	h.service
		.createDraft(
			{
				collection: "note",
				slug,
				metadata: { headline, ...(summary ? { summary } : {}) },
				body: `Body of ${headline}`,
				format: "mdx",
			} as never,
			{ publishImmediately: true },
		)
		.then((result) => result.entry);

describe("git-sync with a title field that is not named title", () => {
	it("exports the title as the front matter key `title`, the other fields as stored", async () => {
		const entry = await publishNote("exported", "Exported headline", "A summary");
		const text = h.repo.files("main").get("content/note/exported.en.mdx");
		expect(text).toBeDefined();
		const parsed = parseFile(text ?? "");
		expect(parsed.ok && parsed.data).toMatchObject({
			title: "Exported headline",
			summary: "A summary",
			slug: "exported",
			monti: { id: entry.id, collection: "note" },
		});
		expect(parsed.ok && parsed.data).not.toHaveProperty("headline");
	});

	it("imports an edited `title` back into the title field", async () => {
		const entry = await publishNote("imported", "Before");
		const path = "content/note/imported.en.mdx";
		const text = h.repo.files("main").get(path) ?? "";
		h.repo.commit("main", [{ path, text: text.replace("title: Before", "title: After") }]);

		expect((await push()).status).toBe(200);
		const after = await h.store.getEntry(entry.id);
		expect(after.published?.metadata).toMatchObject({ headline: "After" });
		expect(after.published?.metadata).not.toHaveProperty("title");
	});

	it("takes a file written by hand with a `title` key, and names the draft's pull request after the title", async () => {
		const path = "content/note/by-hand.en.mdx";
		h.repo.commit("main", [{ path, text: composeFile({ title: "By hand", slug: "by-hand" }, "Written in git") }]);
		expect((await push()).status).toBe(200);
		const found = await h.store.getPublishedEntryBySlug({
			collection: "note",
			slug: "by-hand",
			locale: "en",
			includeBody: false,
		});
		expect(found.status).toBe("current");
		expect(found.status === "current" && found.entry.metadata).toMatchObject({ headline: "By hand" });

		const draft = (
			await h.service.createDraft({
				collection: "note",
				slug: "drafted",
				metadata: { headline: "Drafted headline" },
				body: "x",
				format: "mdx",
			} as never)
		).entry;
		expect(draft.status).toBe("draft");
		const pr = h.repo.pullRequests.find((item) => item.head.endsWith("drafted"));
		expect(pr?.title).toBe("Draft: Drafted headline");
	});
});
