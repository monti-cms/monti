import { emptyStoredDocument } from "@monti-cms/core/document";
import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "../site";
import { slugRule } from "./slug-rule";

const test = testServer();
const cms = defineConfig({ schema, hooks: slugRule, ...test.server });

beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});

const draft = (slug: string) =>
	cms
		.contentService()
		.createDraft({ collection: "post", slug, metadata: { title: "Hello" }, doc: emptyStoredDocument() });

describe("slug rule", () => {
	it("refuses an uppercase or non-ASCII slug with an error that says what to write", async () => {
		for (const slug of ["Hello-World", "안녕", "hello_world", "-hello"]) {
			const error = await draft(slug).catch((caught) => caught);
			expect(error).toMatchObject({ code: "validation_failed" });
			expect(error.issues).toEqual([expect.objectContaining({ code: "slug_not_lowercase_ascii", path: "slug" })]);
			expect(error.message).toContain(`The slug "${slug}" must use only lowercase a-z`);
		}
	});

	it("accepts a lowercase ASCII slug, and the entry keeps it", async () => {
		const created = await draft("hello-world-2");
		expect(created.workingSlug).toBe("hello-world-2");
	});
});
