import "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { diffSources, type SourceChange, type TranslationUnit } from "../../../core/src/core/translation/source-diff";
import { documentToMdx } from "../format";
import { docOfMdx as docOf } from "../testing";

/** Footnote definitions are blocks of the document only a notation with footnotes can say, so these cases are written as MDX. */
const text = (unit: TranslationUnit) =>
	unit.kind === "header"
		? unit.source
		: documentToMdx({ type: "doc", version: 2, content: [unit.node] } as never).trimEnd();

const diffText = (before: string, after: string) => diffSources(docOf(before), docOf(after));

const summary = (changes: SourceChange[] | null) =>
	changes?.map((change) =>
		change.kind === "changed"
			? ["changed", text(change.before), text(change.after)]
			: change.kind === "added"
				? ["added", text(change.after)]
				: ["removed", text(change.before)],
	);

describe("comparing two source versions with footnotes", () => {
	it("treats a footnote definition as one unit and compares it like other blocks", () => {
		const before = "본문[^a]\n\n[^a]: 첫 각주\n";
		const after = "본문[^a]\n\n[^a]: 고친 각주\n";
		expect(summary(diffText(before, after))).toEqual([["changed", "[^a]: 첫 각주", "[^a]: 고친 각주"]]);
		const [change] = diffText(before, after) ?? [];
		expect(change?.kind === "changed" && change.after.type).toBe("footnoteDefinition");
		expect(change?.kind === "changed" && change.after.auto).toBe(false);
	});

	it("finds added and removed footnote definitions", () => {
		const base = "본문[^a]\n\n[^a]: 하나\n";
		const extended = "본문[^a][^b]\n\n[^a]: 하나\n\n[^b]: 둘\n";
		expect(summary(diffText(base, extended))).toEqual([
			["changed", "본문[^a]", "본문[^a][^b]"],
			["added", "[^b]: 둘"],
		]);
		expect(summary(diffText(extended, base))).toEqual([
			["changed", "본문[^a][^b]", "본문[^a]"],
			["removed", "[^b]: 둘"],
		]);
	});

	it("does not pair a footnote definition with a paragraph", () => {
		expect(summary(diffText("본문[^a]\n\n[^a]: 하나\n", "본문[^a]\n\n[^a]: 하나\n\n마지막 문단\n"))).toEqual([
			["added", "마지막 문단"],
		]);
	});
});
