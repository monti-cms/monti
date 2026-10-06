import { describe, expect, it } from "vitest";
import { prepareSnapshot, validateForPublish } from "../../../core/snapshot";

/**
 * Code review (2026-09-26) regression tests that use the reference blog config's blocks (tabs, tooltip, alignment).
 * The rest, which are config-independent, live in `review-regressions.test.ts`.
 */
describe("review regressions (blog blocks)", () => {
	it("blocks publishing blocks without required attributes", async () => {
		const cases: [string, string][] = [
			["<Tabs>\n\n<Tab>\n\n첫\n\n</Tab>\n\n<Tab>\n\n둘\n\n</Tab>\n\n</Tabs>", "missing_block_attribute"],
			// Written back, a missing required attribute becomes an empty one, so this text does not read back the same: it is an unparsed body.
			["문장 <Tooltip>표시</Tooltip> 끝", "unparsed_body"],
			["<TextAlign>\n\n가운데\n\n</TextAlign>", "missing_block_attribute"],
			['<TextAlign align="justify">\n\n가운데\n\n</TextAlign>', "invalid_block_attribute"],
			[
				'<Tabs defaultValue="없음">\n\n<Tab label="a">\n\n1\n\n</Tab>\n\n<Tab label="b">\n\n2\n\n</Tab>\n\n</Tabs>',
				"invalid_block_attribute",
			],
		];
		for (const [mdx, code] of cases) {
			const snapshot = await prepareSnapshot({ collection: "memo", slug: "m", metadata: { title: "m" }, mdx });
			const result = validateForPublish(snapshot, { targets: [], media: [] });
			expect(result.ready, mdx).toBe(false);
			expect(
				result.issues.map((issue) => issue.code),
				mdx,
			).toContain(code);
		}
	});

	it("blocks publishing a document whose text decoration lacks its required attribute, at the block", async () => {
		const doc = {
			type: "doc",
			version: 2,
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "표시", marks: [{ type: "tooltip" }] }],
				},
			],
		};
		const snapshot = await prepareSnapshot({ collection: "memo", slug: "m", metadata: { title: "m" }, doc });
		const missing = validateForPublish(snapshot, { targets: [], media: [] }).issues.find(
			(issue) => issue.code === "missing_block_attribute",
		);
		expect(missing).toMatchObject({ message: "tooltip.content", position: { blockId: snapshot.doc.content[0]?.id } });
	});
});
