import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "../site";
import { lowercaseSlugs, slugRule, slugRulePlugin } from "./slug-rule";

const refusing = testServer();
const fixing = testServer();
const packaged = testServer();
const refuse = defineConfig({ schema, plugins: [mdx()], hooks: slugRule, ...refusing.server });
// Both hooks in one: `transform` fixes what can be fixed, `validate` refuses what is left.
const fix = defineConfig({ schema, plugins: [mdx()], hooks: { ...lowercaseSlugs, ...slugRule }, ...fixing.server });

// The same rules as a plugin with inline hooks: no `server` module.
const asPlugin = defineConfig({ schema, plugins: [mdx(), slugRulePlugin()], ...packaged.server });

beforeAll(() => Promise.all([refuse.migrate(), fix.migrate(), asPlugin.migrate()]));
afterAll(async () => {
	await Promise.all([refuse.close(), fix.close(), asPlugin.close()]);
	await Promise.all([refusing.drop(), fixing.drop(), packaged.drop()]);
});

const draft = (cms: typeof refuse | typeof asPlugin, slug: string) =>
	cms
		.contentService()
		.createDraft({ collection: "post", slug, metadata: { title: "Hello" }, body: "Hi.", format: "mdx" })
		.then((result) => result.entry);

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

describe("slug rule: as a plugin with inline hooks", () => {
	it("needs no server module, and runs in the same pipeline", async () => {
		expect(slugRulePlugin().server).toBeUndefined();
		expect((await asPlugin.writeHooks()).map((source) => source.owner)).toEqual(["plugin:slug-rule"]);
	});

	it("fixes what lowercasing can fix and refuses the rest", async () => {
		expect((await draft(asPlugin, "Hello-Plugin")).workingSlug).toBe("hello-plugin");
		await expect(draft(asPlugin, "Привет")).rejects.toMatchObject({ code: "validation_failed" });
	});
});
