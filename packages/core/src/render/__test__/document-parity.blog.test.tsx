import { describe, expect, it } from "vitest";
import { readSamples } from "../../mdx/__test__/fixtures/samples";
import { bodyFromMdx } from "../../mdx/stored-document";
import { renderBoth, stubComponents } from "./parity";

/** The sample posts are written with the reference blog's blocks, so this runs with the reference blog config only. */
describe("JSON renderer parity with renderMdx: sample posts", () => {
	const samples = readSamples().filter(({ mdx }) => bodyFromMdx(mdx).doc);

	it("has posts that are stored as documents", () => {
		expect(samples.length).toBeGreaterThan(0);
	});

	for (const { name, mdx } of samples) {
		it(`${name} renders the same markup and table of contents`, async () => {
			const parity = await renderBoth(mdx, stubComponents());
			expect(parity.document).toBe(parity.mdx);
			expect(parity.tocDocument).toEqual(parity.tocMdx);
			expect(parity.unknown).toBe(0);
		});
	}
});
