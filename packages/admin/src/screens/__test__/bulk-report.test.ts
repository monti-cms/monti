import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import type { BulkItemResult, BulkSelection } from "../../api/entries";
import { commonMessages } from "../../lib/common.messages";
import { bulkReport, selectionAfter } from "../bulk-report";
import { bulkBarMessages } from "../entries/bulk-bar.messages";
import { screensMessages } from "../messages";
import { deleteMessages } from "../shared/delete.messages";

const t = testSite.createTranslator(screensMessages);
const tb = testSite.createTranslator(bulkBarMessages);
const tc = testSite.createTranslator(commonMessages);
const td = testSite.createTranslator(deleteMessages);

const LABEL = "Archive";
const done = (id: string): BulkItemResult => ({ id, ok: true, version: 2 });
const refused = (id: string): BulkItemResult => ({ id, ok: false, error: "conflict" });
const items: BulkSelection[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, expectedVersion: 1, title: `Post ${id}` }));
const line = (id: string) => `Post ${id} — ${tb("failure.conflict")}`;

describe("bulkReport", () => {
	it.each([
		{
			case: "a clean run says how many went through",
			op: "archive",
			results: [done("a"), done("b")],
			want: { tone: "success", message: t("bulk.success", { count: 2, label: LABEL }) },
		},
		{
			case: "a clean move of one to the trash",
			op: "trash",
			results: [done("a")],
			want: { tone: "success", message: td("trash.done") },
		},
		{
			case: "a clean move of several to the trash counts them",
			op: "trash",
			results: [done("a"), done("b")],
			want: { tone: "success", message: td("trash.done.count", { count: 2 }) },
		},
		{
			case: "a clean change of a relation says nothing",
			op: "relation.add",
			results: [done("a"), done("b")],
			want: null,
		},
		{
			case: "a run with some failures counts both and names the failed ones",
			op: "trash",
			results: [done("a"), refused("b")],
			want: {
				tone: "error",
				message: [t("bulk.partial", { ok: 1, label: LABEL, failed: 1 }), line("b")].join("\n"),
			},
		},
		{
			case: "a run where everything failed names the first three",
			op: "archive",
			results: [refused("a"), refused("b"), refused("c"), refused("d")],
			want: {
				tone: "error",
				message: [t("bulk.failed", { label: LABEL }), line("a"), line("b"), line("c")].join("\n"),
			},
		},
		{
			case: "a failed change of a relation is told",
			op: "relation.add",
			results: [refused("a")],
			want: { tone: "error", message: [t("bulk.failed", { label: LABEL }), line("a")].join("\n") },
		},
	] as const)("$case", ({ op, results, want }) => {
		expect(bulkReport(testSite, op, LABEL, results, items)).toEqual(want);
	});

	it("names a failed row with no title as untitled", () => {
		expect(bulkReport(testSite, "archive", LABEL, [refused("x")], [])?.message).toBe(
			[t("bulk.failed", { label: LABEL }), `${tc("untitled")} — ${tb("failure.conflict")}`].join("\n"),
		);
	});
});

describe("selectionAfter", () => {
	it("keeps the failed rows picked, and leaves the selection alone after a change of a relation", () => {
		expect(selectionAfter("trash", [done("a"), refused("b"), refused("c")])).toEqual(new Set(["b", "c"]));
		expect(selectionAfter("archive", [done("a")])).toEqual(new Set());
		expect(selectionAfter("relation.add", [refused("a")])).toBeNull();
	});
});
