import { describe, expect, it } from "vitest";
import blog from "../../../test/cms.config";
import { STORED_DOCUMENT_VERSION } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { createSite } from "../../site";
import { prepareSnapshot, validateForPublish } from "../snapshot";

const site = createSite(blog);

/** The publish check of the reference blog config's blocks (tabs, tooltip, alignment): their required and valid attributes. */
describe("validateForPublish with the blog's blocks", () => {
	it("blocks publishing blocks without required or valid attributes", async () => {
		const text = (value: string): CmsNode => ({ type: "paragraph", content: [{ type: "text", text: value }] });
		const tab = (attrs: Record<string, string>, value: string): CmsNode => ({
			type: "tab",
			attrs,
			content: [text(value)],
		});
		const cases: [string, CmsNode, string][] = [
			[
				"a tab without its label",
				{ type: "tabs", content: [tab({}, "첫"), tab({ label: "b" }, "둘")] },
				"missing_block_attribute",
			],
			[
				"a default tab that no tab has",
				{
					type: "tabs",
					attrs: { defaultValue: "없음" },
					content: [tab({ label: "a" }, "1"), tab({ label: "b" }, "2")],
				},
				"invalid_block_attribute",
			],
		];
		for (const [name, block, code] of cases) {
			const snapshot = await prepareSnapshot(site, {
				collection: "memo",
				slug: "m",
				metadata: { title: "m" },
				doc: { type: "doc", version: STORED_DOCUMENT_VERSION, content: [block] },
			});
			const result = validateForPublish(site, snapshot, { targets: [], media: [] });
			expect(result.ready, name).toBe(false);
			expect(
				result.issues.map((issue) => issue.code),
				name,
			).toContain(code);
		}
	});

	it("blocks publishing a document whose text decoration lacks its required attribute, at the block", async () => {
		const doc = {
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "표시", marks: [{ type: "tooltip" }] }],
				},
			],
		};
		const snapshot = await prepareSnapshot(site, { collection: "memo", slug: "m", metadata: { title: "m" }, doc });
		const missing = validateForPublish(site, snapshot, { targets: [], media: [] }).issues.find(
			(issue) => issue.code === "missing_block_attribute",
		);
		expect(missing).toMatchObject({ message: "tooltip.content", position: { blockId: snapshot.doc.content[0]?.id } });
	});
});
