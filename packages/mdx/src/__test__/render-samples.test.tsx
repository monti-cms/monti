import { describe, expect, it } from "vitest";
import { bodyFromMdx, readSamples, renderFixture } from "../testing";

/** The sample posts are written with the reference blog's blocks, so this runs with the reference blog config only. */
describe("renderMdx: sample posts", () => {
	const samples = readSamples().filter(({ mdx }) => bodyFromMdx(mdx).doc);

	it("has posts that are stored as documents", () => {
		expect(samples.length).toBeGreaterThan(0);
	});

	for (const { name, mdx } of samples) {
		it(`${name} renders, and its table of contents links to its headings`, async () => {
			const rendered = await renderFixture(mdx);
			// A block the site draws with its own component (a diagram) has no component here and is reported as unknown; nothing else may be.
			for (const node of rendered.unknown) expect(node.type).toBe("codeBlock");
			expect(rendered.html.length).toBeGreaterThan(0);
			for (const item of rendered.toc) expect(item.href).toBe(`#${item.id}`);
		});
	}
});
