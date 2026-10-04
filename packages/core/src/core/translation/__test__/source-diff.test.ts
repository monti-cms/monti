import { describe, expect, it } from "vitest";
import { BLOCKS } from "../../../blocks/active";
import type { BlockDefinition } from "../../../blocks/define";
import { diffSources, type SourceChange } from "../source-diff";

/**
 * 블록 이름은 지금 설정에서 찾는다(블로그 예시 설정과 다른 사이트 설정 둘 다로 돈다). 설정에 그런 블록이 없으면
 * 그 경우는 건너뛴다(예: 다른 사이트 설정에는 펼치는 제목 상자와 탭 묶음이 없다).
 */
const translatableOf = (block: BlockDefinition | undefined) =>
	block && Object.entries(block.attributes).find(([, attribute]) => attribute.translatable)?.[0];
/** 펼쳐서 비교하는 제목 있는 상자(예: 콜아웃). 정렬은 본체 블록이라 어느 설정에나 있다. */
const titledBox = BLOCKS.find(
	(block) =>
		block.syntax.kind === "container" &&
		block.translateInside &&
		!block.children?.blocks &&
		!block.parent &&
		translatableOf(block),
);
const titleAttribute = translatableOf(titledBox);
/** 그 상자의 번역하지 않는 글 속성(있으면, 예: 콜아웃 종류)과 넣을 값. */
const otherAttribute = titledBox
	? Object.entries(titledBox.attributes)
			.filter(([name, attribute]) => attribute.type === "string" && name !== titleAttribute)
			.map(([name, attribute]) => `${name}="${attribute.options ? Object.keys(attribute.options)[0] : "x"}"`)[0]
	: undefined;
/** 자식의 번역할 속성(예: 탭 이름)을 머리 줄 하나로 모으는 펼치는 묶음(예: 탭 묶음). */
const labeledGroup = BLOCKS.flatMap((block) => {
	const child = BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
	const label = translatableOf(child);
	return block.translateInside && child && label ? [{ block, child, label }] : [];
})[0];

const summary = (changes: SourceChange[] | null) =>
	changes?.map((change) =>
		change.kind === "changed"
			? ["changed", change.before.source, change.after.source]
			: change.kind === "added"
				? ["added", change.after.source]
				: ["removed", change.before.source],
	);

describe("원문 두 버전 비교(v3)", () => {
	it("같으면 바뀐 것이 없다", () => {
		expect(diffSources("하나\n\n둘\n", "하나\n\n둘\n")).toEqual([]);
	});

	it("바뀐·더해진·빠진 블록을 문서 순서로 찾는다", () => {
		expect(
			summary(diffSources("하나\n\n둘\n\n셋\n\n넷\n", "하나 고침\n\n둘\n\n새 문단\n\n넷\n\n## 새 제목\n")),
		).toEqual([
			["changed", "하나", "하나 고침"],
			["changed", "셋", "새 문단"],
			["added", "## 새 제목"],
		]);
		expect(summary(diffSources("하나\n\n둘\n\n셋\n", "하나\n\n셋\n"))).toEqual([["removed", "둘"]]);
	});

	it("상자 안 블록은 따로 비교한다", () => {
		const before = ':::text-align{align="center"}\n안쪽\n\n그대로\n:::\n';
		const after = ':::text-align{align="center"}\n안쪽 고침\n\n그대로\n:::\n';
		expect(summary(diffSources(before, after))).toEqual([["changed", "안쪽", "안쪽 고침"]]);
	});

	it.skipIf(!titledBox || !titleAttribute)("상자 안 블록과 제목도 따로 비교한다", () => {
		if (!titledBox || !titleAttribute) return;
		const box = (title: string, body: string) =>
			`:::${titledBox.name}{${[otherAttribute, `${titleAttribute}="${title}"`].filter(Boolean).join(" ")}}\n${body}\n:::\n`;
		expect(summary(diffSources(box("알림", "안쪽"), box("주의", "안쪽 고침")))).toEqual([
			["changed", JSON.stringify({ title: "알림" }), JSON.stringify({ title: "주의" })],
			["changed", "안쪽", "안쪽 고침"],
		]);
	});

	it.skipIf(!labeledGroup)("탭 이름은 탭 묶음 머리 줄 하나로 모아 비교한다", () => {
		if (!labeledGroup) return;
		const { block, child, label } = labeledGroup;
		const tabs = (second: string) =>
			`::::${block.name}\n:::${child.name}{${label}="하나"}\n첫째\n:::\n:::${child.name}{${label}="${second}"}\n둘째\n:::\n::::\n`;
		expect(summary(diffSources(tabs("둘"), tabs("둘 고침")))).toEqual([
			["changed", JSON.stringify({ labels: ["하나", "둘"] }), JSON.stringify({ labels: ["하나", "둘 고침"] })],
		]);
	});

	it("해석할 수 없는 원문이면 null", () => {
		expect(diffSources("본문 <TextAlign>닫히지 않음", "하나\n")).toBeNull();
	});
});
