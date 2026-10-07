import { describe, expect, it } from "vitest";
import { testSite } from "../../test/site";
import { type BareunResponse, bareunIssues, joinSegments } from "../mapping";
import { bareunMessages } from "../messages";
import sample from "./fixtures/bareun-sample.json";

// Category names follow the admin language from the config, so the same wording is picked from the dictionary (descriptions are the Korean text Bareun returns, as is).
const t = testSite.createTranslator(bareunMessages);

// A real Bareun response (the request text is three paragraphs joined with `\n`; the third paragraph starts with the hidden placeholder `￼`).
const segments = sample.request.split("\n").map((text, index) => ({ id: `p-${index}`, text, locale: "ko" }));
const response = sample.response as BareunResponse;

describe("bareunIssues", () => {
	it("splitting the joined paragraphs again gives the request text", () => {
		expect(segments).toHaveLength(3);
		expect(joinSegments(segments)).toBe(sample.request);
		expect(response.origin).toBe(sample.request);
	});

	it("splits a real response into in-paragraph positions and expands merged blocks into individual fixes", () => {
		const issues = bareunIssues(testSite, segments, response);
		expect(issues.map(({ segmentId, start, end }) => [segmentId, start, end])).toEqual([
			["p-0", 12, 17],
			["p-1", 0, 6],
			["p-1", 3, 8],
			["p-2", 10, 15],
		]);
		for (const issue of issues) {
			const text = segments.find((segment) => segment.id === issue.segmentId)?.text ?? "";
			expect(issue.suggestions).not.toContain(text.slice(issue.start, issue.end));
		}
		expect(issues.map((issue) => issue.suggestions)).toEqual([
			["갔습니다."],
			["띄어쓰기가"],
			["쓰기가 없는"],
			["있습니다."],
		]);
		// The merged block ("Merged") is not in the result.
		expect(issues.some((issue) => issue.ruleId === "Merged")).toBe(false);
	});

	it("fills in category, severity, description and source", () => {
		const [standard, spacing] = bareunIssues(testSite, segments, response);
		expect(standard).toEqual({
			segmentId: "p-0",
			start: 12,
			end: 17,
			message: `${t("category.STANDARD")}: ‘-읍니다’는 비표준어이고 ‘-습니다’가 표준어이다.`,
			suggestions: ["갔습니다."],
			severity: "error",
			ruleId: "STANDARD-읍니다",
			category: "spelling",
			source: "bareun",
		});
		expect(spacing).toMatchObject({
			message: `${t("category.SPACING")}: 형태상 띄어 쓸 수 있지만, 짧은 단어는 붙여쓰도록 사전에 등재되어 있다.`,
			severity: "error",
			category: "spacing",
			ruleId: "붙여쓰기_등재된단어",
		});
	});

	it("drops results that touch the hidden placeholder (￼), cross a paragraph boundary, or do not match the original text", () => {
		const block = (beginOffset: number, length: number, content: string) => ({
			origin: { content, beginOffset, length },
			revised: "x",
			revisions: [{ revised: "x", category: "TYPO", helpId: "t" }],
		});
		const issues = bareunIssues(testSite, segments, {
			revisedBlocks: [
				block(34, 4, "￼ 다음"), // hidden placeholder
				block(15, 4, "다.\n띄"), // paragraph boundary
				block(0, 2, "엉뚱"), // position that differs from the original text
				block(37, 3, "음에도"), // inside the third paragraph: kept
			],
		});
		expect(issues.map(({ segmentId, start, end }) => [segmentId, start, end])).toEqual([["p-2", 3, 6]]);
	});

	it("sets severity and category name per category and collects suggestions without duplicates", () => {
		const one = [{ id: "a", text: "가나다라마바사아자차카타파하" }];
		const block = (beginOffset: number, category: string, revised: string[]) => ({
			origin: { content: one[0]?.text.slice(beginOffset, beginOffset + 1), beginOffset, length: 1 },
			revisions: revised.map((text) => ({ revised: text, category, helpId: category })),
		});
		const issues = bareunIssues(testSite, one, {
			revisedBlocks: [
				// proto3 JSON omits positions that are 0.
				{ origin: { content: "가", length: 1 }, revisions: [{ revised: "까", category: "TYPO" }] },
				block(1, "GRAMMER", ["너", "너", "나"]),
				block(2, "WORD", ["더"]),
				block(3, "SENTENCE", ["러"]),
				block(4, "FOREIGN_WORD", ["모"]),
				block(5, "CONFUSABLE_WORDS", ["보"]),
				block(6, "CONFIRM", ["사"]),
				block(7, "THINKING", ["오"]),
			],
			helps: { GRAMMER: { comment: "첫 문장이다. 둘째 문장은 뺀다." } },
		});
		expect(issues.map((issue) => [issue.category, issue.severity])).toEqual([
			["spelling", "error"],
			["grammar", "error"],
			["spelling", "error"],
			["style", "warning"],
			["term", "warning"],
			["term", "warning"],
			["confirm", "warning"],
			["thinking", "warning"],
		]);
		expect(issues[0]).toMatchObject({ start: 0, end: 1, message: t("category.TYPO"), suggestions: ["까"] });
		expect(issues[0]?.ruleId).toBeUndefined();
		expect(issues[1]).toMatchObject({ message: `${t("category.GRAMMER")}: 첫 문장이다.`, suggestions: ["너"] });
		// Suggestions identical to the original text are dropped.
		expect(issues[6]?.suggestions).toEqual([]);
	});

	it("every category code has English and Korean names", () => {
		const kinds = Object.keys(bareunMessages.messages.en).filter((key) => key.startsWith("category."));
		for (const key of kinds) expect(bareunMessages.messages.ko?.[key as never], key).toBeDefined();
	});

	it("returns an empty array when there are no results", () => {
		expect(bareunIssues(testSite, segments, {})).toEqual([]);
	});
});
