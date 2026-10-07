import { describe, expect, it } from "vitest";
import { defineCollection, fields } from "../..";
import { findTitleField, titleFieldOf, titleValue } from "../walk";

const slug = fields.slug({ label: "Slug" });

describe("the title field of a collection", () => {
	it("is the field named title when no field has the title role, so existing schemas keep working", () => {
		const schema = defineCollection({
			label: "Post",
			kind: "document",
			fields: { title: fields.text({ label: "Title" }), slug, summary: fields.text({ label: "Summary" }) },
		});
		expect(titleFieldOf(schema).name).toBe("title");
		expect(titleValue(schema, { title: "Hello", summary: "x" })).toBe("Hello");
	});

	it("is the field with the title role, whatever its name", () => {
		const schema = defineCollection({
			label: "Post",
			kind: "document",
			fields: { headline: fields.text({ label: "Headline", role: "title" }), slug },
		});
		expect(titleFieldOf(schema).name).toBe("headline");
		expect(titleValue(schema, { headline: "Hello", title: "not this" })).toBe("Hello");
	});

	it("gives null for a title that is not a string, and nothing for a schema without a title field", () => {
		const schema = defineCollection({
			label: "Post",
			kind: "document",
			fields: { headline: fields.text({ label: "Headline", role: "title" }), slug },
		});
		expect(titleValue(schema, { headline: 3 })).toBeNull();
		expect(titleValue(schema, {})).toBeNull();
		const untitled = defineCollection({
			label: "Post",
			kind: "document",
			fields: { name: fields.text({ label: "Name" }), slug },
		});
		expect(findTitleField(untitled)).toBeUndefined();
		expect(() => titleFieldOf(untitled)).toThrow(/no title field/);
	});

	it("is never a field that is not text", () => {
		const schema = defineCollection({
			label: "Post",
			kind: "document",
			fields: { title: fields.select({ label: "Title", options: { a: "A" }, defaultValue: "a" }), slug },
		});
		expect(findTitleField(schema)).toBeUndefined();
	});
});
