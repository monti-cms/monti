import { type CmsNode, STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import type { FormatIssue } from "@monti-cms/core/format";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../core/test/site";
import { EditorToggle } from "./editor-toggle";
import { createMdxBrowserFormat } from "./format";

const mdxBrowserFormat = createMdxBrowserFormat(testSite);

const headingDoc = (text: string): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text }] }],
});

/** The content of a document without block ids, which a text never carries. */
const contentOf = (doc: StoredDocument | null) => (doc?.content ?? []).map(({ id: _id, ...rest }) => rest);

describe("EditorToggle", () => {
	it("opens valid MDX in visual mode", () => {
		const source = "# Hello\n\nWorld!";
		const toggle = new EditorToggle(source, mdxBrowserFormat);
		expect(toggle.mode).toBe("visual");
		expect(toggle.errors).toHaveLength(0);
		expect(toggle.document).not.toBeNull();
		expect(toggle.source).toBe(source);
	});

	it("falls back to source mode for invalid MDX, preserving original source", () => {
		const invalidSource = "# Hello\n\n<Component>";
		const toggle = new EditorToggle(invalidSource, mdxBrowserFormat);
		expect(toggle.mode).toBe("source");
		expect(toggle.errors.length).toBeGreaterThan(0);
		expect(toggle.document).toBeNull();
		expect(toggle.source).toBe(invalidSource);
	});

	it("surfaces errors, stays in source mode, and preserves original bytes for syntactically valid but disallowed MDX", () => {
		const disallowedSource = '<Callout onClick={() => alert("x")}>Caution</Callout>';
		const toggle = new EditorToggle(disallowedSource, mdxBrowserFormat);
		expect(toggle.mode).toBe("source");
		expect(toggle.errors.length).toBeGreaterThan(0);
		expect(toggle.errors.some((error) => error.params?.reason === "event_handler_attribute")).toBe(true);
		expect(toggle.document).toBeNull();
		expect(toggle.source).toBe(disallowedSource);
	});

	it("toggles to source without edits returns exact original bytes", () => {
		const source = "# Hello\n\nWorld!";
		const toggle = new EditorToggle(source, mdxBrowserFormat);
		expect(toggle.mode).toBe("visual");

		toggle.toggleToSource();
		expect(toggle.mode).toBe("source");
		expect(toggle.source).toBe(source);
	});

	it("toggles to source after edits returns the written document and roundtrips semantically", () => {
		const source = "# Hello\n\nWorld!";
		const toggle = new EditorToggle(source, mdxBrowserFormat);

		const newDoc = headingDoc("Hello Changed");
		toggle.notifyVisualChange(newDoc);

		toggle.toggleToSource();
		expect(toggle.mode).toBe("source");
		expect(toggle.source).toBe("# Hello Changed\n");

		const roundtrip = mdxBrowserFormat.import(toggle.source);
		expect(roundtrip.ok).toBe(true);
		if (roundtrip.ok) {
			expect(contentOf(roundtrip.doc)).toEqual(contentOf(newDoc));
		}
	});

	it("toggling from source back to visual re-reads the text", () => {
		const source = "# Hello\n\nWorld!";
		const toggle = new EditorToggle(source, mdxBrowserFormat);

		toggle.toggleToSource();
		expect(toggle.mode).toBe("source");

		toggle.updateSource("# New Source\n");
		toggle.toggleToVisual();

		expect(toggle.mode).toBe("visual");
		expect(toggle.source).toBe("# New Source\n");
		expect(toggle.document).not.toBeNull();
	});

	it("does not mutate internal document or falsely write it when the document getter's return value is mutated", () => {
		const source = "# Hello\n\nWorld!";
		const toggle = new EditorToggle(source, mdxBrowserFormat);

		const doc = toggle.document;
		expect(doc).not.toBeNull();
		if (!doc) return;

		const mutable = doc.content as CmsNode[];
		if (mutable[0]) {
			mutable[0] = { type: "paragraph", content: [{ type: "text", text: "Mutated externally" }] };
		}
		(doc as { type: string }).type = "mutated";

		const currentDoc = toggle.document;
		expect(currentDoc).not.toEqual(doc);
		expect(currentDoc?.type).toBe("doc");
		expect(currentDoc?.content?.[0]?.type).toBe("heading");

		toggle.toggleToSource();
		expect(toggle.mode).toBe("source");
		expect(toggle.source).toBe(source);

		toggle.toggleToVisual();
		expect(toggle.mode).toBe("visual");
		expect(contentOf(toggle.document)).toEqual(contentOf(currentDoc));
	});

	it("does not mutate internal state when the object passed to notifyVisualChange is mutated after notification", () => {
		const source = "# Hello\n\nWorld!";
		const toggle = new EditorToggle(source, mdxBrowserFormat);

		const newDoc = headingDoc("Original Update");
		toggle.notifyVisualChange(newDoc);

		const mutable = newDoc.content as CmsNode[];
		if (mutable[0]) {
			mutable[0] = { type: "paragraph", content: [{ type: "text", text: "Mutated After Notification" }] };
		}

		const currentDoc = toggle.document;
		expect(currentDoc?.content?.[0]?.type).toBe("heading");
		expect(currentDoc?.content?.[0]?.content?.[0]?.text).toBe("Original Update");

		toggle.toggleToSource();
		expect(toggle.source).toBe("# Original Update\n");
	});

	it("does not expose the destructive visual load method on the public API", () => {
		type PublicKeys = keyof EditorToggle;
		type HasOpenVisual = "openVisual" extends PublicKeys ? true : false;
		const hasOpenVisual: HasOpenVisual = false;
		expect(hasOpenVisual).toBe(false);
	});

	it("does not alter subsequent errors read when returned errors value is mutated or cleared", () => {
		const invalidSource = "# Hello\n\n<Component>";
		const toggle = new EditorToggle(invalidSource, mdxBrowserFormat);

		expect(toggle.errors.length).toBeGreaterThan(0);
		const initialCount = toggle.errors.length;
		const initialMessage = toggle.errors[0]?.message;

		const errorsCopy = toggle.errors as FormatIssue[];
		errorsCopy.length = 0;
		expect(toggle.errors).toHaveLength(initialCount);

		const errorsCopy2 = toggle.errors as FormatIssue[];
		const first = errorsCopy2[0];
		if (first?.position) {
			(first as { message?: string }).message = "mutated message";
			(first.position as { line: number }).line = 999;
		}

		const subsequentErrors = toggle.errors;
		expect(subsequentErrors).toHaveLength(initialCount);
		expect(subsequentErrors[0]?.message).toBe(initialMessage);
		expect(subsequentErrors[0]?.position?.line).not.toBe(999);
	});
});
