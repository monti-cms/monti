import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "../site";
import { lowercaseSlugs, slugRule } from "./slug-rule";

const refusing = testServer();
const fixing = testServer();
const refuse = defineConfig({ schema, plugins: [mdx()], hooks: slugRule, ...refusing.server });
// Both hooks in one: `transform` fixes what can be fixed, `validate` refuses what is left.
const fix = defineConfig({ schema, plugins: [mdx()], hooks: { ...lowercaseSlugs, ...slugRule }, ...fixing.server });

beforeAll(() => Promise.all([refuse.migrate(), fix.migrate()]));
afterAll(async () => {
	await Promise.all([refuse.close(), fix.close()]);
	await Promise.all([refusing.drop(), fixing.drop()]);
});

const draft = (cms: typeof refuse, slug: string) =>
	cms
		.contentService()
		.createDraft({ collection: "post", slug, metadata: { title: "Hello" }, body: "Hi.", format: "mdx" });

describe("slug rule: refuse", () => {
	it("refuses an uppercase or non-ASCII slug with an error that says what to write", async () => {
		for (const slug of ["Hello-World", "안녕", "hello_world", "-hello"]) {
			const error = await draft(refuse, slug).catch((caught) => caught);
			expect(error).toMatchObject({ code: "validation_failed" });
			expect(error.issues).toEqual([expect.objectContaining({ code: "slug_not_lowercase_ascii", path: "slug" })]);
			expect(error.message).toContain(`The slug "${slug}" must use only lowercase a-z`);
		}
	});

	it("accepts a lowercase ASCII slug, and the entry keeps it", async () => {
		expect((await draft(refuse, "hello-world-2")).workingSlug).toBe("hello-world-2");
	});

	it("holds for the admin API too, because every write goes through one pipeline", async () => {
		const response = await refuse.handle(
			new Request("https://blog.example/api/cms/v1/entries", {
				method: "POST",
				headers: { "content-type": "application/json", origin: "https://blog.example" },
				body: JSON.stringify({
					collection: "post",
					slug: "API-Slug",
					metadata: { title: "Hello" },
					body: "Hi.",
					format: "mdx",
				}),
			}),
		);
		expect(response.status).toBe(422);
		expect(await response.json()).toMatchObject({ code: "validation_failed", issues: [{ path: "slug" }] });
	});
});

describe("slug rule: fix, then refuse the rest", () => {
	it("lowercases a slug instead of refusing it", async () => {
		expect((await draft(fix, "Hello-World")).workingSlug).toBe("hello-world");
	});

	it("still refuses what lowercasing cannot fix", async () => {
		await expect(draft(fix, "Привет")).rejects.toMatchObject({ code: "validation_failed" });
	});
});
