import { describe, expect, it } from "vitest";
import { fieldMarks } from "../field-marks";
import { addField, newField, type Obj, recordRename, removeField, renameField, setCollection } from "../schema-model";

const saved: Obj = {
	collections: {
		post: {
			label: "Post",
			kind: "document",
			fields: {
				title: { kind: "text", label: "Title" },
				summary: { kind: "text", label: "Summary" },
				subtitle: { kind: "text", label: "Subtitle" },
				cover: { kind: "media", label: "Cover" },
			},
		},
	},
};

describe("what the list of fields marks", () => {
	it("SCHEMA-F8 marks a rename with its old name, a new field, and keeps the removed one where it was", () => {
		let draft = setCollection(saved, "post", (c) => renameField(c, {}, "summary", "excerpt"));
		draft = setCollection(draft, "post", (c) => removeField(c, {}, "subtitle"));
		draft = setCollection(draft, "post", (c) => addField(c, {}, "format", newField("select", "Format")));
		const renames = recordRename([], { kind: "field", collection: "post", from: "summary", to: "excerpt" });
		const { marks, gone } = fieldMarks(saved, draft, renames, "post");
		expect(marks).toEqual({ excerpt: { kind: "renamed", from: "summary" }, format: { kind: "added" } });
		expect(gone).toEqual([{ name: "subtitle", label: "Subtitle", after: "excerpt" }]);
	});

	it("SCHEMA-F8 marks an edited field and puts a removed first field at the start", () => {
		let draft = setCollection(saved, "post", (c) => ({
			...c,
			fields: { ...(c.fields as Obj), cover: { kind: "media", label: "Image" } },
		}));
		draft = setCollection(draft, "post", (c) => removeField(c, {}, "title"));
		const { marks, gone } = fieldMarks(saved, draft, [], "post");
		expect(marks).toEqual({ cover: { kind: "edited" } });
		expect(gone).toEqual([{ name: "title", label: "Title", after: null }]);
	});

	it("SCHEMA-F8 is empty for the saved file", () => {
		expect(fieldMarks(saved, saved, [], "post")).toEqual({ marks: {}, gone: [] });
	});
});
