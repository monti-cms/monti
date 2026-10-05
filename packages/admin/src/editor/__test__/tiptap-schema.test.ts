import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { CMS_SCHEMA_EXTENSIONS, CmsTextAlign } from "../tiptap-schema";

const schema = getSchema([StarterKit, ...CMS_SCHEMA_EXTENSIONS]);

describe("paragraph and heading alignment settings", () => {
	it("headings and paragraphs have a textAlign attribute with no default", () => {
		// The default is null, so body text without alignment is saved without `style`.
		expect(schema.nodes.heading.spec.attrs?.textAlign?.default).toBeNull();
		expect(schema.nodes.paragraph.spec.attrs?.textAlign?.default).toBeNull();
	});

	it("allowed alignments are only left, center, and right (justify is forbidden)", () => {
		expect(CmsTextAlign.options.alignments).not.toContain("justify");
		expect(CmsTextAlign.options.alignments).toEqual(expect.arrayContaining(["left", "center", "right"]));
		expect(CmsTextAlign.options.types).toEqual(expect.arrayContaining(["heading", "paragraph"]));
	});
});
