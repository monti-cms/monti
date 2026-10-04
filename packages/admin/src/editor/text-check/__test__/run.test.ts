import { buildEditorExtensions, mdxToTiptap } from "@monti-cms/admin/editor";
import { defineTextChecker, normalizeIssue, supportsLocale, type TextCheckSegment } from "@monti-cms/core/client";
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractSegments } from "../extract";
import { createTextCheckPlugin, type TextCheckMeta, textCheckIssues, textCheckPluginKey } from "../plugin";
import { checkSegments, chunkSegments, placeIssues, TextCheckCache } from "../run";

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

const open = (mdx: string) => {
	editor = new Editor({ extensions: buildEditorExtensions(), content: mdxToTiptap(mdx) });
	editor.registerPlugin(createTextCheckPlugin());
	return editor;
};

/** 글자 `word`를 찾아 표시하는 검사기. */
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

/** 캐시에 든 결과를 문서 전체에 놓는다(편집기 버튼 검사와 같은 길). */
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

describe("검사기 정의", () => {
	it("자동 검사는 기본으로 꺼져 있다", () => {
		expect(defineTextChecker({ id: "a", label: "A", check: async () => [] }).auto).toBe(false);
		expect(defineTextChecker({ id: "a", label: "A", auto: true, check: async () => [] }).auto).toBe(true);
	});

	it("잘못된 이름·한도는 받지 않는다", () => {
		expect(() => defineTextChecker({ id: "a b", label: "A", check: async () => [] })).toThrow();
		expect(() => defineTextChecker({ id: "a", label: "A", limits: { maxChars: 0 }, check: async () => [] })).toThrow();
	});

	it("언어는 첫 부분까지 맞춘다", () => {
		const ko = defineTextChecker({ id: "ko", label: "ko", locales: ["ko-KR"], check: async () => [] });
		expect(supportsLocale(ko, "ko")).toBe(true);
		expect(supportsLocale(ko, "en")).toBe(false);
		expect(supportsLocale(defineTextChecker({ id: "any", label: "any", check: async () => [] }), "ja")).toBe(true);
	});
});

describe("나눠 보내기와 캐시", () => {
	const segment = (id: string, text: string): TextCheckSegment => ({ id, text, locale: "ko" });

	it("문단 수·글자 수 한도에 맞춰 나눈다", () => {
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

	it("같은 글자는 다시 보내지 않고 한도마다 나눠 보낸다", async () => {
		const current = open("가 틀린말\n\n나 틀린말\n\n가 틀린말\n");
		const checker = defineTextChecker({ ...wordChecker("틀린말", "맞는 말"), limits: { maxSegments: 1 } });
		const cache = new TextCheckCache();
		const segments = extractSegments(current.state.doc, { locale: "ko" });
		const signal = new AbortController().signal;
		await checkSegments({ checker, segments, locale: "ko", cache, signal });
		// 같은 글자 두 문단은 한 번만, 한 번에 한 문단씩.
		expect(checker.check).toHaveBeenCalledTimes(2);
		await checkSegments({ checker, segments, locale: "ko", cache, signal });
		expect(checker.check).toHaveBeenCalledTimes(2);
		expect(placeIssues({ checkers: [checker], segments, locale: "ko", cache })).toHaveLength(3);
	});

	it("끊으면 더 보내지 않는다", async () => {
		const current = open("가\n\n나\n");
		const checker = defineTextChecker({ ...wordChecker("가", "카"), limits: { maxSegments: 1 } });
		const controller = new AbortController();
		controller.abort();
		await expect(
			checkSegments({
				checker,
				segments: extractSegments(current.state.doc, { locale: "ko" }),
				locale: "ko",
				cache: new TextCheckCache(),
				signal: controller.signal,
			}),
		).rejects.toMatchObject({ name: "AbortError" });
		expect(checker.check).not.toHaveBeenCalled();
	});

	it("검사기 결과의 잘못된 값은 버리고 빠진 값은 채운다", () => {
		expect(normalizeIssue({ start: 0, end: 9, message: "x", suggestions: [] }, 5, "c")).toBeNull();
		expect(normalizeIssue({ start: 2, end: 1, message: "x", suggestions: [] }, 5, "c")).toBeNull();
		expect(normalizeIssue({ start: 0, end: 1, suggestions: [] }, 5, "c")).toBeNull();
		expect(
			normalizeIssue({ start: 0, end: 1, message: "x", suggestions: ["a", "a", 3], severity: "fatal" }, 5, "c"),
		).toEqual({ start: 0, end: 1, message: "x", suggestions: ["a"], severity: "warning", source: "c" });
	});
});

describe("밑줄 장식과 편집", () => {
	it("결과를 물결 밑줄로 그린다", async () => {
		const current = open("이것은 틀린말 입니다\n");
		const [issue] = await checkDoc(current, wordChecker("틀린말", "맞는 말"));
		expect(issue && current.state.doc.textBetween(issue.from, issue.to)).toBe("틀린말");
		const mark = current.view.dom.querySelector(".cms-text-issue");
		expect(mark?.textContent).toBe("틀린말");
		expect(mark?.getAttribute("data-severity")).toBe("error");
	});

	it("앞쪽 문단을 고치면 결과가 위치를 따라간다", async () => {
		const current = open("앞 문단\n\n이것은 틀린말 입니다\n");
		await checkDoc(current, wordChecker("틀린말", "맞는 말"));
		current.commands.insertContentAt(2, "아주 긴 ");
		const [issue] = textCheckIssues(current.state);
		expect(issue && current.state.doc.textBetween(issue.from, issue.to)).toBe("틀린말");
	});

	it("결과 범위 안을 고치면 그 결과는 사라진다", async () => {
		const current = open("이것은 틀린말 입니다\n");
		const [issue] = await checkDoc(current, wordChecker("틀린말", "맞는 말"));
		if (!issue) throw new Error("no issue");
		current.commands.insertContentAt(issue.from + 1, "ㅋ");
		expect(textCheckIssues(current.state)).toHaveLength(0);
		expect(current.view.dom.querySelector(".cms-text-issue")).toBeNull();
	});

	it("굵게 같은 마크만 바꾸면 결과는 남는다", async () => {
		const current = open("이것은 틀린말 입니다\n");
		const [issue] = await checkDoc(current, wordChecker("틀린말", "맞는 말"));
		if (!issue) throw new Error("no issue");
		current.chain().setTextSelection({ from: issue.from, to: issue.to }).toggleBold().run();
		expect(textCheckIssues(current.state)).toHaveLength(1);
	});

	it("다시 검사하면 그 검사기의 결과만 바꾼다", async () => {
		const current = open("틀린말 그른말\n");
		const cache = new TextCheckCache();
		await checkDoc(current, wordChecker("틀린말", "맞는 말", "first"), cache);
		await checkDoc(current, wordChecker("그른말", "옳은 말", "second"), cache);
		expect(textCheckIssues(current.state).map((issue) => issue.checkerId)).toEqual(["first", "second"]);
		// 같은 검사기가 이번에는 아무것도 찾지 않았다(새 캐시: 같은 글자의 이전 결과를 쓰지 않게).
		await checkDoc(current, wordChecker("없는말", "", "second"), new TextCheckCache());
		expect(textCheckIssues(current.state).map((issue) => issue.checkerId)).toEqual(["first"]);
	});

	it("밑줄을 누르면 그 결과를 알린다", async () => {
		const current = open("이것은 틀린말 입니다\n");
		const onIssueClick = vi.fn();
		current.unregisterPlugin(textCheckPluginKey);
		const plugin = createTextCheckPlugin({ onIssueClick });
		current.registerPlugin(plugin);
		const [issue] = await checkDoc(current, wordChecker("틀린말", "맞는 말"));
		if (!issue) throw new Error("no issue");
		const target = current.view.dom.querySelector(".cms-text-issue");
		const click = plugin.props.handleClick;
		click?.call(plugin, current.view, issue.from + 1, { button: 0, target } as unknown as MouseEvent);
		expect(onIssueClick).toHaveBeenCalledWith(expect.objectContaining({ key: issue.key }), current.view);
		// 밑줄이 아닌 곳은 열지 않는다.
		click?.call(plugin, current.view, 1, { button: 0, target: current.view.dom } as unknown as MouseEvent);
		expect(onIssueClick).toHaveBeenCalledTimes(1);
	});
});
