import { analyze } from "@monti-cms/core/mdx";
import { computeContentHash } from "@monti-cms/core/runtime";
import { readSamples } from "@monti-cms/core/testing";
import { describe, expect, it } from "vitest";
import { mdxWith } from "../../test/mdx-syntax";
import { directiveSyntax } from "..";

/** The sample posts are written with the reference blog's blocks (callouts, tabs, tooltips), so this runs only with the reference blog config. */
const readOnly = [directiveSyntax({ write: false })];
const { write } = mdxWith(readOnly);
const metadata = { title: "A" };
const hashBefore = (mdx: string) => computeContentHash(metadata, mdx, 1, analyze(mdx, undefined, readOnly));
/** The written body is read with no extension at all: it is standard MDX. */
const hashAfter = (mdx: string) => computeContentHash(metadata, mdx, 1);

describe("migrating real posts to standard MDX", () => {
	it("real posts keep their content hash", () => {
		for (const { name, mdx } of readSamples()) {
			const written = write(mdx);
			expect(analyze(written).errors, name).toEqual([]);
			expect(hashAfter(written), name).toBe(hashBefore(mdx));
			expect(write(written), name).toBe(written);
		}
	});
});
