import { describe, expectTypeOf, it } from "vitest";
import { defineCollection, defineSite, fields } from "../../index";
import type { Cms } from "../types";

/** What a developer sends to the write services (`createDraft`, `saveDraft`) and what comes back when it is wrong. */

const config = defineSite({
	collections: {
		article: defineCollection({
			label: "Article",
			kind: "document",
			fields: {
				title: fields.text({ label: "Title", required: true }),
				slug: fields.slug({ label: "Slug", from: "title", required: true }),
				excerpt: fields.text({ label: "Excerpt" }),
			},
		}),
		label: defineCollection({
			label: "Label",
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

describe("types follow the config", () => {
	it("SCHEMA-S1 the service of an instance knows its collections", () => {
		type Service = ReturnType<Cms<typeof config>["contentService"]>;
		type Input = Parameters<Service["createDraft"]>[0];
		expectTypeOf<{ collection: "label"; slug: null; metadata: { title: string } }>().toExtend<Input>();
		expectTypeOf<{ collection: "article"; slug: null; metadata: { title: string } }>().not.toExtend<Input>();
		expectTypeOf<{
			collection: "nope";
			slug: null;
			metadata: Record<string, never>;
			doc: unknown;
		}>().not.toExtend<Input>();
	});
});
