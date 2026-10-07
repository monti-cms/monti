import { analyze } from "@monti-cms/mdx/format";
import { mdxWith, readSamples } from "@monti-cms/mdx/testing";
import { describe, expect, it } from "vitest";
import { hashOf } from "../../test/hash";
import { testSite } from "../../test/site";
import { directiveSyntax } from "..";

/** The sample posts are written with the reference blog's blocks (callouts, tabs, tooltips), so this runs only with the reference blog config. */
const readOnly = [directiveSyntax({ write: false })];
const { write } = mdxWith(testSite, readOnly);
const metadata = { title: "A" };
const hashBefore = (mdx: string) => hashOf(testSite, metadata, mdx, 1, readOnly);
/** The written body is read with no extension at all: it is standard MDX. */
const hashAfter = (mdx: string) => hashOf(testSite, metadata, mdx, 1);

describe("migrating real posts to standard MDX", () => {
	it("real posts keep their content hash", () => {
		for (const { name, mdx } of readSamples()) {
			const written = write(mdx);
			expect(analyze(testSite, written).errors, name).toEqual([]);
			expect(hashAfter(written), name).toBe(hashBefore(mdx));
			expect(write(written), name).toBe(written);
		}
	});
});
