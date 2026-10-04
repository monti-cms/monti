import { createTranslator } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { type BareunResponse, bareunIssues, joinSegments } from "../mapping";
import { bareunMessages } from "../messages";
import sample from "./fixtures/bareun-sample.json";

// 분류 이름은 설정의 관리자 언어를 따르므로 사전에서 같은 말을 고른다(설명은 바른이 주는 한국어 글 그대로다).
const t = createTranslator(bareunMessages);

// 실제 바른 응답(요청 글은 세 문단을 `\n`으로 이은 것, 셋째 문단 첫 글자는 숨긴 자리 `￼`).
const segments = sample.request.split("\n").map((text, index) => ({ id: `p-${index}`, text, locale: "ko" }));
const response = sample.response as BareunResponse;

describe("bareunIssues", () => {
	it("이어 보낸 문단을 다시 나눈 것이 요청 글과 같다", () => {
		expect(segments).toHaveLength(3);
		expect(joinSegments(segments)).toBe(sample.request);
		expect(response.origin).toBe(sample.request);
	});

	it("실제 응답을 문단 안 위치로 나누고 합친 블록은 낱낱의 고침으로 펼친다", () => {
		const issues = bareunIssues(segments, response);
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
		// 합친 블록("Merged")은 결과에 없다.
		expect(issues.some((issue) => issue.ruleId === "Merged")).toBe(false);
	});

	it("분류·심각도·설명·출처를 채운다", () => {
		const [standard, spacing] = bareunIssues(segments, response);
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

	it("숨긴 자리(￼)에 걸치거나 문단 경계를 넘거나 원문이 맞지 않는 결과는 뺀다", () => {
		const block = (beginOffset: number, length: number, content: string) => ({
			origin: { content, beginOffset, length },
			revised: "x",
			revisions: [{ revised: "x", category: "TYPO", helpId: "t" }],
		});
		const issues = bareunIssues(segments, {
			revisedBlocks: [
				block(34, 4, "￼ 다음"), // 숨긴 자리
				block(15, 4, "다.\n띄"), // 문단 경계
				block(0, 2, "엉뚱"), // 원문과 다른 위치
				block(37, 3, "음에도"), // 셋째 문단 안: 남는다
			],
		});
		expect(issues.map(({ segmentId, start, end }) => [segmentId, start, end])).toEqual([["p-2", 3, 6]]);
	});

	it("분류마다 심각도·분류 이름을 맞추고 후보는 겹치지 않게 모은다", () => {
		const one = [{ id: "a", text: "가나다라마바사아자차카타파하" }];
		const block = (beginOffset: number, category: string, revised: string[]) => ({
			origin: { content: one[0]?.text.slice(beginOffset, beginOffset + 1), beginOffset, length: 1 },
			revisions: revised.map((text) => ({ revised: text, category, helpId: category })),
		});
		const issues = bareunIssues(one, {
			revisedBlocks: [
				// proto3 JSON은 0인 위치를 빼고 보낸다.
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
		// 원문과 같은 후보는 뺀다.
		expect(issues[6]?.suggestions).toEqual([]);
	});

	it("모든 분류 코드가 영어·한국어 이름을 가진다", () => {
		const kinds = Object.keys(bareunMessages.messages.en).filter((key) => key.startsWith("category."));
		expect(kinds).toHaveLength(11);
		for (const key of kinds) expect(bareunMessages.messages.ko?.[key as never], key).toBeDefined();
	});

	it("결과가 없으면 빈 배열이다", () => {
		expect(bareunIssues(segments, {})).toEqual([]);
	});
});
