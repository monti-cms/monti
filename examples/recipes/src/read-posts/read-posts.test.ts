import { testServer } from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { type BlogCms, createBlogCms } from "./cms";
import { findTag, getPost, listPosts } from "./read-posts";

const test = testServer();
const cms = createBlogCms(test.server);

const published = new Map<string, { id: string; version: number }>();
const publish = async (slug: string, metadata: { summary: string; tagIds: string[] }) => {
	const service = cms.contentService();
	const draft = await service.createDraft({
		collection: "post",
		slug,
		metadata: { title: slug, ...metadata },
		body: "Body.",
		format: "mdx",
	});
	published.set(slug, (await service.publish({ id: draft.id, expectedVersion: draft.version })).entry);
};

beforeAll(async () => {
	await cms.migrate();
	// An item collection has no body, so there is nothing to give besides the name. A tag is published when it is created.
	const tag = await cms
		.contentService()
		.createDraft({ collection: "tag", slug: "monti", metadata: { title: "Monti" } });
	for (const [slug, tagIds] of [
		["first", [tag.id]],
		["second", []],
		["third", [tag.id]],
	] as const)
		await publish(slug, { summary: `About ${slug}`, tagIds: [...tagIds] });
});
afterAll(async () => {
	await cms.close();
	await test.drop();
});

describe("reading posts on the public site", () => {
	it("lists posts, newest first, with their tags", async () => {
		const page = await listPosts(cms);
		expect(page?.posts.map((post) => post.slug)).toEqual(["third", "second", "first"]);
		expect(page?.posts[0]).toMatchObject({ title: "third", summary: "About third", path: "/posts/third" });
		expect(page?.posts[0]?.tags.map((tag) => tag.title)).toEqual(["Monti"]);
	});

	it("lists the posts of a tag, and answers null for a tag that does not exist", async () => {
		expect((await listPosts(cms, { tag: "monti" }))?.posts.map((post) => post.slug)).toEqual(["third", "first"]);
		expect(await listPosts(cms, { tag: "nope" })).toBeNull();
		expect((await findTag(cms, "monti"))?.title).toBe("Monti");
	});

	it("reads one post, or says it is missing", async () => {
		const found = await getPost(cms, "first");
		expect(found && "post" in found && found.post?.title).toBe("first");
		expect(await getPost(cms, "missing")).toBeNull();
	});

	it("follows a renamed address with a redirect", async () => {
		const service = cms.contentService();
		const second = published.get("second");
		if (!second) throw new Error("second was not published");
		const draft = await service.saveDraft(second.id, {
			collection: "post",
			slug: "second-renamed",
			metadata: { title: "second" },
			body: "Body.",
			format: "mdx",
			expectedVersion: second.version,
		});
		await service.publish({ id: draft.id, expectedVersion: draft.version });
		expect(await getPost(cms, "second")).toEqual({ redirectTo: "/posts/second-renamed" });
	});
});

// Never called: `pnpm typecheck` compiles it, which is the test. `@ts-expect-error` fails the build if the line below it ever compiles.
async function typedResults() {
	const { items } = await cms.read.listEntries({ collection: "post" });
	const [post] = items;
	if (!post) return;
	expectTypeOf(post.collection).toEqualTypeOf<"post">();
	expectTypeOf(post.metadata.title).toEqualTypeOf<string>(); // a required field is never undefined in a published entry
	expectTypeOf(post.metadata.summary).toEqualTypeOf<string | undefined>();
	expectTypeOf(post.metadata.tagIds).toEqualTypeOf<readonly string[] | undefined>();
	// @ts-expect-error a post has no field "subtitle"
	post.metadata.subtitle;
	// @ts-expect-error "nope" is not a collection of this site
	await cms.read.listEntries({ collection: "nope" });
	expectTypeOf(cms).toEqualTypeOf<BlogCms>();

	// The write side knows the same: an item collection (a tag) needs no body, a post needs one.
	await cms.contentService().createDraft({ collection: "tag", slug: "t", metadata: { title: "T" } });
	// @ts-expect-error a post needs a body (`doc`, or `body` and `format`)
	await cms.contentService().createDraft({ collection: "post", slug: "p", metadata: { title: "P" } });
	// @ts-expect-error the title is text
	await cms
		.contentService()
		.createDraft({ collection: "post", slug: "p", metadata: { title: 1 }, body: "", format: "mdx" });
}

describe("the results are typed from the config", () => {
	it("is checked when the package is type checked (see typedResults)", () => {
		expect(typedResults).toBeTypeOf("function");
	});
});
