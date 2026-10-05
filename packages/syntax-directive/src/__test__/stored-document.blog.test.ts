import { bodyFromDocument, bodyFromMdx, readStoredDocument, type StoredDocument } from "@monti-cms/core/mdx";
import { readSamples } from "@monti-cms/core/testing";
import { describe, expect, it } from "vitest";
import { directiveSyntax } from "..";

/** The sample posts are written with the reference blog's blocks (callouts, tabs, tooltips), so this runs only with the reference blog config. */
const directives = [directiveSyntax()];
const readOnly = [directiveSyntax({ write: false })];

describe("stored documents of real directive posts", () => {
	it("store every post as a document that writes back to the same directive text", () => {
		for (const { name, mdx } of readSamples()) {
			const body = bodyFromMdx(mdx, directives);
			expect(body.doc, name).not.toBeNull();
			const doc = body.doc as StoredDocument;
			expect(bodyFromMdx(body.mdx, directives).mdx, name).toBe(body.mdx);
			const reread = readStoredDocument(JSON.parse(JSON.stringify(doc))) as StoredDocument;
			expect(bodyFromDocument(reread, directives).mdx, name).toBe(body.mdx);
		}
	});

	it("is the same document whichever notation the body is written in", () => {
		for (const { name, mdx } of readSamples()) {
			const doc = bodyFromMdx(mdx, directives).doc as StoredDocument;
			// Written as standard MDX (directives only read), then read back: the same document.
			const standard = bodyFromDocument(doc, readOnly);
			expect(standard.doc, name).toEqual(doc);
			expect(standard.mdx, name).not.toMatch(/^:::/m);
		}
	});
});
