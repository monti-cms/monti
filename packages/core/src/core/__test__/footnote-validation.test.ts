import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { STORED_DOCUMENT_VERSION } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { prepareSnapshot } from "../snapshot";

/** A paragraph of the text with its `[^label]` markers made footnote references. */
const paragraph = (text: string): CmsNode => {
	const content: CmsNode[] = [];
	let last = 0;
	for (const match of text.matchAll(/\[\^([^\]]+)\]/g)) {
		if ((match.index ?? 0) > last) content.push({ type: "text", text: text.slice(last, match.index) });
		content.push({ type: "footnoteReference", attrs: { label: match[1] ?? "" } });
		last = (match.index ?? 0) + match[0].length;
	}
	if (last < text.length) content.push({ type: "text", text: text.slice(last) });
	return { type: "paragraph", content };
};
/** A footnote definition of a label with one paragraph. */
const definition = (label: string, text: string): CmsNode => ({
	type: "footnoteDefinition",
	attrs: { label },
	content: [paragraph(text)],
});

const footnoteWarnings = async (...content: CmsNode[]) => {
	const snapshot = await prepareSnapshot({
		collection: contentCollection,
		slug: "footnotes",
		metadata: { title: "Footnotes" },
		doc: { type: "doc", version: STORED_DOCUMENT_VERSION, content },
	} as never);
	return {
		snapshot,
		warnings: (snapshot.warnings ?? []).filter((warning) => warning.code.startsWith("footnote_")),
	};
};

describe("footnote pre-publish validation (warnings only)", () => {
	it("raises nothing for matching references and definitions", async () => {
		const { warnings, snapshot } = await footnoteWarnings(
			paragraph("A[^1] and B[^b] and A again[^1]."),
			definition("1", "one"),
			definition("b", "two"),
		);
		expect(warnings).toEqual([]);
		expect(snapshot.issues).toEqual([]);
	});

	it("warns about a reference without a definition", async () => {
		const { warnings, snapshot } = await footnoteWarnings(
			paragraph("Text[^1] and more[^gone]."),
			definition("1", "one"),
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			code: "footnote_definition_missing",
			message: "gone",
			params: { label: "gone" },
			// The paragraph that holds the reference.
			position: { blockId: snapshot.doc.content[0]?.id },
		});
		// It is a warning, not a blocking issue.
		expect(snapshot.issues).toEqual([]);
	});

	it("warns about a definition that no reference uses", async () => {
		const { warnings, snapshot } = await footnoteWarnings(
			paragraph("Text[^1]"),
			definition("1", "one"),
			definition("spare", "nobody cites me"),
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			code: "footnote_definition_unused",
			message: "spare",
			params: { label: "spare" },
			// The definition that nobody cites: the third block.
			position: { blockId: snapshot.doc.content[2]?.id },
		});
		expect(snapshot.issues).toEqual([]);
	});

	it("warns about duplicate definition labels once per extra definition", async () => {
		const { warnings, snapshot } = await footnoteWarnings(
			paragraph("Text[^a]"),
			definition("a", "one"),
			definition("A", "two"),
		);
		expect(warnings.map((warning) => warning.code)).toEqual(["footnote_definition_duplicate"]);
		expect(warnings[0]).toMatchObject({
			message: "A",
			params: { label: "A" },
			position: { blockId: snapshot.doc.content[2]?.id },
		});
	});

	it("matches labels case-insensitively", async () => {
		const { warnings } = await footnoteWarnings(paragraph("Text[^Note]"), definition("note", "one"));
		expect(warnings).toEqual([]);
	});

	it("reports each problem separately", async () => {
		const { warnings } = await footnoteWarnings(
			paragraph("Text[^a] [^zz]"),
			definition("a", "one"),
			definition("b", "two"),
			definition("a", "three"),
		);
		expect(warnings.map((warning) => warning.code).sort()).toEqual([
			"footnote_definition_duplicate",
			"footnote_definition_missing",
			"footnote_definition_unused",
		]);
	});
});
