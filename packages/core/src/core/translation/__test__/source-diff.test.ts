import { describe, expect, it } from "vitest";
import { BLOCKS } from "../../../blocks/active";
import type { BlockDefinition } from "../../../blocks/define";
import { diffSources, type SourceChange } from "../source-diff";

/**
 * Block names are looked up in the current config (runs with both the reference blog config and other site configs). If the config has no such block,
 * that case is skipped (e.g. other site configs have no expandable titled box or tab group).
 */
const translatableOf = (block: BlockDefinition | undefined) =>
	block && Object.entries(block.attributes).find(([, attribute]) => attribute.translatable)?.[0];
/** A titled box compared by expanding it (e.g. callout). Alignment is a core block, so any config has it. */
const titledBox = BLOCKS.find(
	(block) =>
		block.syntax.kind === "container" &&
		block.translateInside &&
		!block.children?.blocks &&
		!block.parent &&
		translatableOf(block),
);
const titleAttribute = translatableOf(titledBox);
/** That box's non-translated text attribute (if any, e.g. callout kind) and the value to put in. */
const otherAttribute = titledBox
	? Object.entries(titledBox.attributes)
			.filter(([name, attribute]) => attribute.type === "string" && name !== titleAttribute)
			.map(([name, attribute]) => `${name}="${attribute.options ? Object.keys(attribute.options)[0] : "x"}"`)[0]
	: undefined;
/** An expandable group that gathers children's translatable attributes (e.g. tab names) into one header line (e.g. tab group). */
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

describe("comparing two source versions", () => {
	it("nothing changed when equal", () => {
		expect(diffSources("하나\n\n둘\n", "하나\n\n둘\n")).toEqual([]);
	});

	it("finds changed, added and removed blocks in document order", () => {
		expect(
			summary(diffSources("하나\n\n둘\n\n셋\n\n넷\n", "하나 고침\n\n둘\n\n새 문단\n\n넷\n\n## 새 제목\n")),
		).toEqual([
			["changed", "하나", "하나 고침"],
			["changed", "셋", "새 문단"],
			["added", "## 새 제목"],
		]);
		expect(summary(diffSources("하나\n\n둘\n\n셋\n", "하나\n\n셋\n"))).toEqual([["removed", "둘"]]);
	});

	it("blocks inside a box are compared separately", () => {
		const before = ':::text-align{align="center"}\n안쪽\n\n그대로\n:::\n';
		const after = ':::text-align{align="center"}\n안쪽 고침\n\n그대로\n:::\n';
		expect(summary(diffSources(before, after))).toEqual([["changed", "안쪽", "안쪽 고침"]]);
	});

	it.skipIf(!titledBox || !titleAttribute)("blocks and the title inside a box are compared separately", () => {
		if (!titledBox || !titleAttribute) return;
		const box = (title: string, body: string) =>
			`:::${titledBox.name}{${[otherAttribute, `${titleAttribute}="${title}"`].filter(Boolean).join(" ")}}\n${body}\n:::\n`;
		expect(summary(diffSources(box("알림", "안쪽"), box("주의", "안쪽 고침")))).toEqual([
			["changed", JSON.stringify({ title: "알림" }), JSON.stringify({ title: "주의" })],
			["changed", "안쪽", "안쪽 고침"],
		]);
	});

	it.skipIf(!labeledGroup)("tab names are gathered into one tab group header line for comparison", () => {
		if (!labeledGroup) return;
		const { block, child, label } = labeledGroup;
		const tabs = (second: string) =>
			`::::${block.name}\n:::${child.name}{${label}="하나"}\n첫째\n:::\n:::${child.name}{${label}="${second}"}\n둘째\n:::\n::::\n`;
		expect(summary(diffSources(tabs("둘"), tabs("둘 고침")))).toEqual([
			["changed", JSON.stringify({ labels: ["하나", "둘"] }), JSON.stringify({ labels: ["하나", "둘 고침"] })],
		]);
	});

	it("null when the source cannot be parsed", () => {
		expect(diffSources("본문 <TextAlign>닫히지 않음", "하나\n")).toBeNull();
	});
});
