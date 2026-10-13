import { readStoredDocument, type StoredDocument } from "@monti-cms/core/document";
import { bodyFromMdx } from "@monti-cms/mdx/format";
import { readSamples } from "@monti-cms/mdx/testing";
import { describe, expect, it } from "vitest";
import { testSite } from "../../test/site";
import { directiveSyntax } from "..";

/** The sample posts are written with the reference blog's blocks (callouts, tabs, tooltips), so this runs only with the reference blog config. */
const directives = [directiveSyntax()];

describe("stored documents of real directive posts", () => {
	it("store every post as a document that writes back to the same directive text", () => {
		for (const { name, mdx } of readSamples()) {
			const body = bodyFromMdx(testSite, mdx, directives);
			expect(body.doc, name).not.toBeNull();
			const doc = body.doc as StoredDocument;
			expect(bodyFromMdx(testSite, body.mdx, directives).mdx, name).toBe(body.mdx);
			expect(readStoredDocument(JSON.parse(JSON.stringify(doc)), testSite), name).toEqual(doc);
		}
	});
});
