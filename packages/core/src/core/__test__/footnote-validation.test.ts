import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { prepareSnapshot } from "../snapshot";

const footnoteWarnings = async (mdx: string) => {
	const snapshot = await prepareSnapshot({
		collection: contentCollection,
		slug: "footnotes",
		metadata: { title: "Footnotes" },
		mdx,
	});
	return {
		snapshot,
		warnings: (snapshot.warnings ?? []).filter((warning) => warning.code.startsWith("footnote_")),
	};
};

describe("footnote pre-publish validation (warnings only)", () => {
	it("raises nothing for matching references and definitions", async () => {
		const { warnings, snapshot } = await footnoteWarnings(
			"A[^1] and B[^b] and A again[^1].\n\n[^1]: one\n\n[^b]: two\n",
		);
		expect(warnings).toEqual([]);
		expect(snapshot.issues).toEqual([]);
	});

	it("warns about a reference without a definition", async () => {
		const { warnings, snapshot } = await footnoteWarnings("Text[^1] and more[^gone].\n\n[^1]: one\n");
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			code: "footnote_definition_missing",
			message: "gone",
			params: { label: "gone" },
			position: { line: 1, column: expect.any(Number) },
		});
		// It is a warning, not a blocking issue.
		expect(snapshot.issues).toEqual([]);
	});

	it("does not mistake an escaped marker or inline code for a missing definition", async () => {
		const { warnings } = await footnoteWarnings("\\[^a] and `[^b]`\n");
		expect(warnings).toEqual([]);
	});

	it("warns about a definition that no reference uses", async () => {
		const { warnings, snapshot } = await footnoteWarnings("Text[^1]\n\n[^1]: one\n\n[^spare]: nobody cites me\n");
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			code: "footnote_definition_unused",
			message: "spare",
			params: { label: "spare" },
			position: { line: 5, column: 1 },
		});
		expect(snapshot.issues).toEqual([]);
	});

	it("warns about duplicate definition labels once per extra definition", async () => {
		const { warnings } = await footnoteWarnings("Text[^a]\n\n[^a]: one\n\n[^A]: two\n");
		expect(warnings.map((warning) => warning.code)).toEqual(["footnote_definition_duplicate"]);
		expect(warnings[0]).toMatchObject({ message: "A", params: { label: "A" }, position: { line: 5, column: 1 } });
	});

	it("matches labels case-insensitively", async () => {
		const { warnings } = await footnoteWarnings("Text[^Note]\n\n[^note]: one\n");
		expect(warnings).toEqual([]);
	});

	it("reports each problem separately", async () => {
		const { warnings } = await footnoteWarnings("Text[^a] [^zz]\n\n[^a]: one\n\n[^b]: two\n\n[^a]: three\n");
		expect(warnings.map((warning) => warning.code).sort()).toEqual([
			"footnote_definition_duplicate",
			"footnote_definition_missing",
			"footnote_definition_unused",
		]);
	});
});
