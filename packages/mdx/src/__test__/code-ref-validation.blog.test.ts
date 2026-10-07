import { createSite } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import blog from "../../../core/test/cms.config";
import { prepareSnapshotOf } from "./snapshot-helpers";

const site = createSite(blog);
const prepareSnapshot = prepareSnapshotOf(site);
const contentCollection = site.DOCUMENT_COLLECTIONS[0] as string;

/** Written as JSX: the test site has no syntax extension, and `:code-ref[text]{to}` is read to the same element. */
const snapshotOf = (mdx: string) =>
	prepareSnapshot({
		collection: contentCollection,
		slug: "code-refs",
		metadata: { title: "Code refs" },
		format: "mdx",
		body: mdx,
	});

const fence = (lines: string[], lang = "ts") => [`\`\`\`${lang}`, ...lines, "```"].join("\n");

const codeIssues = (items: readonly { code: string }[] | undefined) =>
	(items ?? []).filter((item) => item.code.startsWith("code_"));

describe("code-ref pre-publish validation", () => {
	it("raises nothing when every link has its label", async () => {
		const snapshot = await snapshotOf(
			[
				'See <CodeRef to="c1">the sum</CodeRef> and <CodeRef to="c1">it again</CodeRef>.',
				"",
				fence(['// @line anchor {1-1} id="c1"', "const a = 1;", "const b = a + 1;"]),
				"",
			].join("\n"),
		);
		expect(codeIssues(snapshot.issues)).toEqual([]);
		expect(codeIssues(snapshot.warnings)).toEqual([]);
	});

	it("blocks publishing a link whose label no code block has, at the link", async () => {
		const snapshot = await snapshotOf(
			[
				"Intro.",
				"",
				'See <CodeRef to="c9">gone</CodeRef>.',
				"",
				fence(['// @line anchor {0-0} id="c1"', "x();"]),
				"",
			].join("\n"),
		);
		expect(codeIssues(snapshot.issues)).toEqual([
			expect.objectContaining({
				code: "code_ref_broken",
				message: "c9",
				params: { id: "c9" },
				// At the link: the paragraph it is in.
				position: { blockId: snapshot.doc.content[1]?.id },
			}),
		]);
	});

	it("warns about a label a second code block uses again, at the second block", async () => {
		const snapshot = await snapshotOf(
			[
				'See <CodeRef to="c1">this</CodeRef>.',
				"",
				fence(['// @line anchor {0-0} id="c1"', "first();"]),
				"",
				fence(['// @line anchor {0-0} id="c1"', "second();"]),
				"",
			].join("\n"),
		);
		expect(codeIssues(snapshot.issues)).toEqual([]);
		expect(codeIssues(snapshot.warnings)).toEqual([
			expect.objectContaining({
				code: "code_anchor_duplicate",
				message: "c1",
				// At the second code block.
				position: { blockId: snapshot.doc.content[2]?.id },
			}),
		]);
	});

	it("does not count one block labelling two ranges with the same label as a duplicate", async () => {
		const snapshot = await snapshotOf(
			[
				'See <CodeRef to="c1">this</CodeRef>.',
				"",
				fence(['// @line anchor {0-0} id="c1"', "a();", '// @line anchor {1-1} id="c1"', "b();"]),
				"",
			].join("\n"),
		);
		expect(codeIssues(snapshot.warnings)).toEqual([]);
	});

	it("reads a label written in the comment syntax of the code's language", async () => {
		const snapshot = await snapshotOf(
			[
				'See <CodeRef to="py1">this</CodeRef>.',
				"",
				fence(['# @line anchor {0-0} id="py1"', "print(1)"], "python"),
				"",
			].join("\n"),
		);
		expect(codeIssues(snapshot.issues)).toEqual([]);
	});

	it("leaves a link without a value to the required attribute check", async () => {
		const snapshot = await snapshotOf('See <CodeRef to="">this</CodeRef>.\n');
		expect(codeIssues(snapshot.issues)).toEqual([]);
		expect(snapshot.issues.map((issue) => issue.code)).toContain("missing_block_attribute");
	});
});
