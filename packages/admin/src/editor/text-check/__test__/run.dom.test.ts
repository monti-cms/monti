import { buildEditorExtensions } from "@monti-cms/admin/editor";
import { defineTextChecker, normalizeIssue, supportsLocale, type TextCheckSegment } from "@monti-cms/core";
import { within } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { tiptapOf } from "../../../test/mdx";
import { extractSegments } from "../extract";
import { createTextCheckPlugin, type TextCheckMeta, textCheckIssues, textCheckPluginKey } from "../plugin";
import { checkSegments, chunkSegments, placeIssues, TextCheckCache } from "../run";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const open = (mdx: string) => {
	editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOf(mdx) });
	editor.registerPlugin(createTextCheckPlugin());
	return editor;
};

/** Checker that finds and flags the text `word`. */
const wordChecker = (word: string, suggestion: string, id = "words") =>
	defineTextChecker({
		id,
		label: "낱말",
		check: vi.fn(async (segments: readonly TextCheckSegment[]) =>
			segments.flatMap((segment) => {
				const start = segment.text.indexOf(word);
				return start < 0
					? []
					: [
							{
								segmentId: segment.id,
								start,
								end: start + word.length,
								message: `'${suggestion}'이 맞습니다.`,
								suggestions: [suggestion],
								severity: "error" as const,
							},
						];
			}),
		),
	});

/** Places cached results across the whole document (same path as the editor button check). */
const checkDoc = async (current: Editor, checker: ReturnType<typeof wordChecker>, cache = new TextCheckCache()) => {
	const segments = extractSegments(current.state.doc, { locale: "ko" });
	await checkSegments({ checker, segments, locale: "ko", cache, signal: new AbortController().signal });
	const issues = placeIssues({ checkers: [checker], segments, locale: "ko", cache });
	const meta: TextCheckMeta = {
		type: "replace",
		checkerIds: [checker.id],
		ranges: segments.map((segment) => ({ from: segment.from, to: segment.to })),
		issues,
	};
	current.view.dispatch(current.state.tr.setMeta(textCheckPluginKey, meta));
	return textCheckIssues(current.state);
};

describe("checker definition", () => {
	it("PLUG-T1 rejects invalid names and limits", () => {
		// The errors name what is wrong: the id as given, and the limit.
		expect(() => defineTextChecker({ id: "a b", label: "A", check: async () => [] })).toThrow(/invalid id "a b"/);
		expect(() => defineTextChecker({ id: "a", label: "A", limits: { maxChars: 0 }, check: async () => [] })).toThrow(
			/limits\.maxChars/,
		);
	});

	it("PLUG-T1 matches languages by their primary subtag", () => {
		const ko = defineTextChecker({ id: "ko", label: "ko", locales: ["ko-KR"], check: async () => [] });
		expect(supportsLocale(ko, "ko")).toBe(true);
		expect(supportsLocale(ko, "en")).toBe(false);
		expect(supportsLocale(defineTextChecker({ id: "any", label: "any", check: async () => [] }), "ja")).toBe(true);
	});
});

describe("batching and cache", () => {
	const segment = (id: string, text: string): TextCheckSegment => ({ id, text, locale: "ko" });

	it("PLUG-T4 splits by paragraph and character limits", () => {
		const list = [segment("a", "12345"), segment("b", "123"), segment("c", "1234567890"), segment("d", "1")];
		expect(chunkSegments(list, { maxSegments: 2 }).map((chunk) => chunk.map((item) => item.id))).toEqual([
			["a", "b"],
			["c", "d"],
		]);
		expect(chunkSegments(list, { maxChars: 8 }).map((chunk) => chunk.map((item) => item.id))).toEqual([
			["a", "b"],
			["c"],
			["d"],
		]);
	});

	it("PLUG-T4 does not resend the same text and sends in batches per limit", async () => {
		const current = open("가 틀린말\n\n나 틀린말\n\n가 틀린말\n");
		const checker = defineTextChecker({ ...wordChecker("틀린말", "맞는 말"), limits: { maxSegments: 1 } });
		const cache = new TextCheckCache();
		const segments = extractSegments(current.state.doc, { locale: "ko" });
		const signal = new AbortController().signal;
		await checkSegments({ checker, segments, locale: "ko", cache, signal });
		// Two paragraphs with the same text are sent once, one paragraph per batch.
		expect(checker.check).toHaveBeenCalledTimes(2);
		await checkSegments({ checker, segments, locale: "ko", cache, signal });
		expect(checker.check).toHaveBeenCalledTimes(2);
		expect(placeIssues({ checkers: [checker], segments, locale: "ko", cache })).toHaveLength(3);
	});

	it("PLUG-T2 drops invalid values in checker results and fills in missing ones", () => {
		expect(normalizeIssue({ start: 0, end: 9, message: "x", suggestions: [] }, 5, "c")).toBeNull();
		expect(normalizeIssue({ start: 2, end: 1, message: "x", suggestions: [] }, 5, "c")).toBeNull();
		expect(normalizeIssue({ start: 0, end: 1, suggestions: [] }, 5, "c")).toBeNull();
		expect(
			normalizeIssue({ start: 0, end: 1, message: "x", suggestions: ["a", "a", 3], severity: "fatal" }, 5, "c"),
		).toEqual({ start: 0, end: 1, message: "x", suggestions: ["a"], severity: "warning", source: "c" });
	});
});

describe("underline decoration and editing", () => {
	it("PLUG-T3 keeps results in place when an earlier paragraph is edited", async () => {
		const current = open("앞 문단\n\n이것은 틀린말 입니다\n");
		await checkDoc(current, wordChecker("틀린말", "맞는 말"));
		current.commands.insertContentAt(2, "아주 긴 ");
		const [issue] = textCheckIssues(current.state);
		expect(issue && current.state.doc.textBetween(issue.from, issue.to)).toBe("틀린말");
	});

	it("PLUG-T3 removes a result when its range is edited", async () => {
		const current = open("이것은 틀린말 입니다\n");
		const [issue] = await checkDoc(current, wordChecker("틀린말", "맞는 말"));
		if (!issue) throw new Error("no issue");
		current.commands.insertContentAt(issue.from + 1, "ㅋ");
		expect(textCheckIssues(current.state)).toHaveLength(0);
		// A kept underline would still wrap the edited word on its own.
		const edited = current.state.doc.textBetween(issue.from, issue.to + 1);
		expect(within(current.view.dom).queryByText(edited)).toBeNull();
	});

	it("PLUG-T1 replaces only that checker's results on recheck", async () => {
		const current = open("틀린말 그른말\n");
		const cache = new TextCheckCache();
		await checkDoc(current, wordChecker("틀린말", "맞는 말", "first"), cache);
		await checkDoc(current, wordChecker("그른말", "옳은 말", "second"), cache);
		expect(textCheckIssues(current.state).map((issue) => issue.checkerId)).toEqual(["first", "second"]);
		// The same checker found nothing this time (fresh cache, so the earlier result for the same text is not reused).
		await checkDoc(current, wordChecker("없는말", "", "second"), new TextCheckCache());
		expect(textCheckIssues(current.state).map((issue) => issue.checkerId)).toEqual(["first"]);
	});
});
