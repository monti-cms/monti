import { describe, expect, expectTypeOf, it } from "vitest";
import type { Cms } from "../../cms";
import { defineCollection, defineSite, fields } from "../../index";
import { createSite } from "../../site";
import { prepareSnapshot } from "../snapshot";
import { type Issue, ServiceError } from "../types";

/** What a developer sends to the write services (`createDraft`, `saveDraft`) and what comes back when it is wrong. */

const config = defineSite({
	collections: {
		post: defineCollection({
			label: "Post",
			kind: "document",
			fields: {
				title: fields.text({ label: "Title", required: true }),
				slug: fields.slug({ label: "Slug", from: "title", required: true }),
				summary: fields.text({ label: "Summary" }),
			},
		}),
		tag: defineCollection({
			label: "Tag",
			kind: "item",
			fields: {
				title: fields.text({ label: "Name", required: true }),
				slug: fields.slug({ label: "Slug", from: "title", required: true }),
			},
		}),
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
});
const site = createSite(config);

describe("an error that reaches a log or a test failure", () => {
	it("says what its issues say, not only its code", () => {
		const issues: Issue[] = [
			{ code: "slug_not_lowercase_ascii", path: "slug", message: 'The slug "A" must be lowercase.' },
			{ code: "empty_body", path: "body" },
			{ code: "third" },
			{ code: "fourth" },
		];
		expect(new ServiceError("validation_failed", issues).message).toBe(
			'validation_failed: The slug "A" must be lowercase. (slug); empty_body (body); third (and 1 more)',
		);
		expect(new ServiceError("invalid_input").message).toBe("invalid_input");
		expect(new ServiceError("hook_failed", issues, "written by the caller").message).toBe("written by the caller");
	});
});

describe("metadata the caller sends", () => {
	const input = (metadata: Record<string, unknown>) =>
		({ collection: "post", slug: "a", metadata, doc: { type: "doc", version: 3, content: [] } }) as never;

	it("WRITE-S7 treats a field set to undefined as a field that is not set", async () => {
		const snapshot = await prepareSnapshot(site, input({ title: "A", summary: undefined }));
		expect(snapshot.metadata).toEqual({ title: "A" });
	});

	it("WRITE-S7 names the field that has the wrong kind of value", async () => {
		const error = await prepareSnapshot(site, input({ title: "A", summary: 3 })).catch((caught) => caught);
		expect(error).toMatchObject({ code: "invalid_metadata_type", issues: [{ path: "summary" }] });
		// The message names the field, the kind it must be and the kind it got.
		expect(error.message).toContain('"summary"');
		expect(error.message).toContain("text");
		expect(error.message).toContain("number");
	});

	it("WRITE-S7 names the field that does not exist, and the ones that do", async () => {
		const error = await prepareSnapshot(site, input({ title: "A", subtitle: "B" })).catch((caught) => caught);
		expect(error).toMatchObject({ code: "invalid_metadata_key", issues: [{ path: "subtitle" }] });
		// The message names the field it got, the collection and the fields it has.
		expect(error.message).toContain('"subtitle"');
		expect(error.message).toMatch(/\bpost\b/);
		expect(error.message).toMatch(/\btitle\b/);
		expect(error.message).toMatch(/\bsummary\b/);
	});
});

describe("an item collection has no body", () => {
	it("WRITE-W6 is written with the metadata only, and its document is empty", async () => {
		const snapshot = await prepareSnapshot(site, {
			collection: "tag",
			slug: "monti",
			metadata: { title: "Monti" },
		} as never);
		expect(snapshot.doc.content).toEqual([]);
		expect(snapshot.metadata).toEqual({ title: "Monti" });
	});

	it("WRITE-S7 is still an error for a document collection to have none", async () => {
		await expect(
			prepareSnapshot(site, { collection: "post", slug: "a", metadata: { title: "A" } } as never),
		).rejects.toMatchObject({ code: "invalid_input" });
	});
});

describe("types follow the config", () => {
	it("SCHEMA-S1 the service of an instance knows its collections", () => {
		type Service = ReturnType<Cms<typeof config>["contentService"]>;
		type Input = Parameters<Service["createDraft"]>[0];
		expectTypeOf<{ collection: "tag"; slug: null; metadata: { title: string } }>().toExtend<Input>();
		expectTypeOf<{ collection: "post"; slug: null; metadata: { title: string } }>().not.toExtend<Input>();
		expectTypeOf<{
			collection: "nope";
			slug: null;
			metadata: Record<string, never>;
			doc: unknown;
		}>().not.toExtend<Input>();
	});
});
