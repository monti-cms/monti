import { testServer } from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBlogCms } from "../read-posts/cms";
import { strictStatus } from "./strict-status";

const test = testServer();
const cms = createBlogCms(test.server);

const publish = async (slug: string) => {
	const service = cms.contentService();
	const draft = (
		await service.createDraft({ collection: "post", slug, metadata: { title: slug }, body: "Body.", format: "mdx" })
	).entry;
	return (await service.publish({ id: draft.id, expectedVersion: draft.version })).entry;
};

beforeAll(async () => {
	await cms.migrate();
	await publish("hello");
	const renamed = await publish("old-name");
	const service = cms.contentService();
	const draft = (
		await service.saveDraft(renamed.id, {
			collection: "post",
			slug: "new-name",
			metadata: { title: "old-name" },
			body: "Body.",
			format: "mdx",
			expectedVersion: renamed.version,
		})
	).entry;
	await service.publish({ id: draft.id, expectedVersion: draft.version });
});
afterAll(async () => {
	await cms.close();
	await test.drop();
});

describe("strict statuses decided before the page", () => {
	it("leaves a published post to its page", async () => {
		expect(await strictStatus(cms, "/posts/hello")).toBeUndefined();
	});

	it("answers 404 for a post that does not exist, and for a malformed address", async () => {
		expect(await strictStatus(cms, "/posts/no-such-post")).toEqual({ status: 404 });
		expect(await strictStatus(cms, "/posts/%E0%A4%A")).toEqual({ status: 404 });
	});

	it("answers 308 with the new address for the old address of a renamed post", async () => {
		expect(await strictStatus(cms, "/posts/old-name")).toEqual({ status: 308, location: "/posts/new-name" });
	});

	it("leaves every other address alone: the list, the home page, deeper paths", async () => {
		for (const pathname of ["/", "/posts", "/posts/", "/posts/hello/comments", "/about"]) {
			expect(await strictStatus(cms, pathname), pathname).toBeUndefined();
		}
	});
});
