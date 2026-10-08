import { defineCollection, defineSite, fields } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { hideOrderWhenNarrow } from "../admin-entries-table";
import { columnsFor } from "../list-columns";

const post = defineCollection({
	label: "Post",
	kind: "document",
	path: "/posts/:slug",
	fields: {
		title: fields.text({ label: "Title" }),
		slug: fields.slug({ label: "Slug", from: "title" }),
		tagIds: fields.relation({ label: "Tags", to: "tag", many: true }),
	},
});
const tag = defineCollection({
	label: "Tag",
	kind: "item",
	fields: { title: fields.text({ label: "Name" }), slug: fields.slug({ label: "Slug", from: "title" }) },
});
const site = createSite(
	defineSite({
		collections: { post, tag },
		locales: [
			{ code: "en", name: "English" },
			{ code: "ko", name: "Korean" },
		],
		defaultLocale: "en",
	}),
);

describe("the post date in the list of a document collection", () => {
	it("is one of the default columns, next to the updated date", () => {
		const { defaults } = columnsFor(site, "post");
		expect(defaults).toContain("updatedAt");
		expect(defaults).toContain("publishedAt");
	});

	it("is the last column to give way when the screen is narrow, not the first", () => {
		const order = hideOrderWhenNarrow(site, "post", columnsFor(site, "post").available);
		const at = (column: string) => order.indexOf(column);
		expect(order.at(-1)).toBe("publishedAt");
		expect(at("publishedAt")).toBeGreaterThan(at("locale"));
		expect(at("publishedAt")).toBeGreaterThan(at("tagIds"));
		// The updated date is never hidden.
		expect(order).not.toContain("updatedAt");
	});
});
