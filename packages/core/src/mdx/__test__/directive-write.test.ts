import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS, ADDED_MARK_BLOCKS, BLOCKS } from "../../blocks/active";
import type { BlockAttribute, BlockDefinition } from "../../blocks/define";
import { analyze, serialize, toDocument } from "..";

/**
 * 블록 이름은 지금 설정에서 찾는다(블로그 예시 설정과 다른 사이트 설정 둘 다로 돈다). 설정에 그런 블록이 없으면 그 경우는
 * 건너뛴다. 본체 블록(밑줄·위첨자·이미지·가운데 정렬 등)은 어느 설정에나 있다.
 */
const stringAttribute = (block: BlockDefinition | undefined): [string, BlockAttribute] | undefined =>
	block && Object.entries(block.attributes).find(([, attribute]) => attribute.type === "string");
/** 그 속성에 넣을 수 있는 값(선택 값이 있으면 첫 값). */
const optionValue = (attribute: BlockAttribute, fallback: string) =>
	attribute.options ? (Object.keys(attribute.options)[0] ?? fallback) : fallback;

/** 본문을 담는 사이트 블록(자식 규칙·부모가 없는 컨테이너, 예: 콜아웃)과 그 글 속성. */
const bodyBlock = ADDED_BLOCKS.find(
	(block) => block.syntax.kind === "container" && !block.children?.blocks && !block.parent && stringAttribute(block),
);
const bodyAttribute = stringAttribute(bodyBlock);
/** 불리언 속성이 있는 컨테이너 블록(예: 접기). */
const booleanBlock = ADDED_BLOCKS.find(
	(block) =>
		block.syntax.kind === "container" &&
		Object.values(block.attributes).some((attribute) => attribute.type === "boolean"),
);
const booleanAttribute = booleanBlock
	? Object.entries(booleanBlock.attributes).find(([, attribute]) => attribute.type === "boolean")?.[0]
	: undefined;
/** 글 속성이 있는 글자 꾸밈 블록(예: 툴팁). */
const markBlock = ADDED_MARK_BLOCKS.find((block) => stringAttribute(block));
const markAttribute = stringAttribute(markBlock);
/** 정해진 자식 블록만 담는 묶음 블록과 그 자식(예: 탭 묶음·탭, 단 나누기·단). */
const groups = ADDED_BLOCKS.flatMap((block) => {
	const child = BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
	return block.syntax.kind === "container" && child?.syntax.kind === "container" ? [{ block, child }] : [];
});
/** 자식 블록 JSX 속성(필수 글 속성만 채운다, 예: 탭 이름). */
const childProps = (child: BlockDefinition, value: string) =>
	Object.entries(child.attributes)
		.filter(([, attribute]) => attribute.type === "string" && attribute.required)
		.map(([name]) => ` ${name}="${value}"`)
		.join("");
const directiveName = (block: BlockDefinition) => ("directive" in block.syntax ? block.syntax.directive : block.name);

/** 쓰기 경로: `MDX → analyze → toDocument → serialize`. */
const write = (source: string): string => serialize(toDocument(analyze(source)));

/** 한 번 더 왕복해도 같은 문자열이어야 한다(멱등). */
const writeTwice = (source: string): string => write(write(source));

describe("M8-ED-2 저장 형식 directive 전환", () => {
	it("읽기 호환 JSX와 HTML 인라인을 directive로 정규화한다", () => {
		expect(write("<u>밑줄</u>").trimEnd()).toBe(":u[밑줄]");
		expect(write("<sup>위</sup>").trimEnd()).toBe(":sup[위]");
		expect(write("<sub>아래</sub>").trimEnd()).toBe(":sub[아래]");
		expect(write("<br/>").trimEnd()).toBe(":br[]");
		expect(write('<TextAlign align="center">\n\n가운데\n\n</TextAlign>').trimEnd()).toBe(
			':::text-align{align="center"}\n가운데\n:::',
		);
	});

	it.skipIf(!bodyBlock || !bodyAttribute)("사이트 컨테이너 블록의 JSX도 directive로 정규화한다", () => {
		if (!bodyBlock || !bodyAttribute) return;
		const { component } = bodyBlock;
		const [name, attribute] = bodyAttribute;
		const value = optionValue(attribute, "note");
		expect(write(`<${component} ${name}="${value}">\n\n본문\n\n</${component}>`).trimEnd()).toBe(
			`:::${directiveName(bodyBlock)}{${name}="${value}"}\n본문\n:::`,
		);
	});

	it.skipIf(!markBlock || !markAttribute)("사이트 글자 꾸밈 블록의 JSX도 directive로 정규화한다", () => {
		if (!markBlock || !markAttribute) return;
		const [name] = markAttribute;
		expect(write(`<${markBlock.component} ${name}="설명">라벨</${markBlock.component}>`).trimEnd()).toBe(
			`:${directiveName(markBlock)}[라벨]{${name}="설명"}`,
		);
	});

	it.skipIf(groups.length < 2)("중첩 컨테이너는 바깥일수록 콜론이 많다(3 + 단계)", () => {
		const [outer, inner] = groups;
		if (!outer || !inner) return;
		const { block: tabs, child: tab } = outer;
		const { block: columns, child: column } = inner;
		const nested = write(
			[
				`<${tabs.component}>`,
				`<${tab.component}${childProps(tab, "a")}>`,
				`<${columns.component}>`,
				`<${column.component}${childProps(column, "c")}>`,
				"깊은 본문",
				`</${column.component}>`,
				`</${columns.component}>`,
				`</${tab.component}>`,
				`<${tab.component}${childProps(tab, "b")}>`,
				"B",
				`</${tab.component}>`,
				`</${tabs.component}>`,
			].join("\n"),
		);

		expect(nested).toContain(`:::::${directiveName(tabs)}`);
		expect(nested).toContain(`::::${directiveName(tab)}`);
		expect(nested).toContain(`:::${directiveName(columns)}`);
		expect(nested).toContain(`:::${directiveName(column)}`);
	});

	it.skipIf(!bodyBlock)("사이트 컨테이너 안의 본체 컨테이너도 바깥이 콜론이 많다", () => {
		if (!bodyBlock) return;
		const { component } = bodyBlock;
		const nested = write(`<${component}>\n<TextAlign align="center">\n깊은 본문\n</TextAlign>\n</${component}>`);

		expect(nested).toContain(`::::${directiveName(bodyBlock)}`);
		expect(nested).toContain(':::text-align{align="center"}');
	});

	it.skipIf(!booleanBlock || !booleanAttribute)("불리언 속성은 참일 때만 이름을 쓰고 거짓·없음은 생략한다", () => {
		if (!booleanBlock || !booleanAttribute) return;
		const { component } = booleanBlock;
		const name = directiveName(booleanBlock);
		expect(write(`<${component} ${booleanAttribute}>본문</${component}>`).trimEnd()).toBe(
			`:::${name}{${booleanAttribute}}\n본문\n:::`,
		);
		expect(write(`<${component} ${booleanAttribute}="false">본문</${component}>`).trimEnd()).toBe(
			`:::${name}\n본문\n:::`,
		);
		expect(write(`<${component}>본문</${component}>`).trimEnd()).toBe(`:::${name}\n본문\n:::`);
	});

	it("Markdown 강조가 성립하지 않는 자리에서는 JSX로 쓴다", () => {
		// 안쪽 끝이 문장부호면 CommonMark 강조가 닫히지 않아 별표가 글자로 남는다.
		expect(write("<strong>정적(Static)</strong>과 동적").trimEnd()).toBe("<strong>정적(Static)</strong>과 동적");
		expect(write('<strong>"인용"</strong>').trimEnd()).toBe('<strong>"인용"</strong>');
		// 성립하는 자리는 Markdown 그대로 둔다.
		expect(write("<strong>정적</strong>과 동적").trimEnd()).toBe("**정적**과 동적");
		expect(write("<em>기울임</em>").trimEnd()).toBe("*기울임*");
		expect(write("<del>취소</del>").trimEnd()).toBe("~~취소~~");
		// 강조가 성립하지 않는 입력은 별표를 글자로 남기지 않는다(이스케이프한다).
		expect(write("**정적(Static)**과 동적").trimEnd()).toBe("\\*\\*정적(Static)\\*\\*과 동적");
	});

	it("문단은 한 줄로 저장하고 줄바꿈은 :br[]로만 표현한다", () => {
		expect(write("첫 줄\\\n둘째 줄").trimEnd()).toBe("첫 줄:br[]둘째 줄");
		expect(write("첫 줄<br/>둘째 줄").trimEnd()).toBe("첫 줄:br[]둘째 줄");
		// 하드브레이크는 문단을 쪼개지 않는다 — raw 줄바꿈을 만들지 않는다.
		const written = write("가\\\n나\\\n다");
		expect(written).toBe("가:br[]나:br[]다\n");
		expect(written.trimEnd().includes("\n")).toBe(false);
	});

	it("이미지는 미디어 참조·크기·정렬·캡션·장식이 있으면 리프로, 없으면 Markdown으로 쓴다", () => {
		expect(write('<Image mediaId="uuid-1" alt="설명" />').trimEnd()).toBe('::image{mediaId="uuid-1" alt="설명"}');
		expect(write('<Image src="/images/a.png" alt="설명" width="60%" align="center" caption="캡션" />').trimEnd()).toBe(
			'::image{src="/images/a.png" alt="설명" width="60%" align="center" caption="캡션"}',
		);
		expect(write('<Image src="/images/a.png" alt="설명" decorative />').trimEnd()).toBe(
			'::image{src="/images/a.png" alt="설명" decorative}',
		);
		expect(write("![설명](/images/a.png)").trimEnd()).toBe("![설명](/images/a.png)");
	});

	it("이스케이프된 `:이름`은 글자로 유지된다", () => {
		// 등록된 이름 뒤에 구분자가 오면 지시자로 읽히므로 `\:`로 끊는다(§4.4).
		expect(write("글자로 쓰는 \\:u[괄호] 예문").trimEnd()).toBe("글자로 쓰는 \\:u\\[괄호] 예문");
		expect(write("줄바꿈 글자 \\:br 입니다").trimEnd()).toBe("줄바꿈 글자 \\:br 입니다");
		expect(write("자물쇠 \\:\\:image{alt=x} 글자").trimEnd()).toBe("자물쇠 :\\:image{alt=x} 글자");
		// 미등록 이름·시각·URL의 콜론은 손대지 않는다.
		expect(write("벡터 rag openai/gpt-oss-120b:free를 쓴다").trimEnd()).toBe(
			"벡터 rag openai/gpt-oss-120b:free를 쓴다",
		);
		expect(write("낮 12:30에 만나요").trimEnd()).toBe("낮 12:30에 만나요");
	});

	it("쓴 문자열을 다시 써도 같은 문자열이다(멱등)", () => {
		const [group] = groups;
		const samples = [
			':::text-align{align="center"}\n\n본문 :u[밑줄] 과 :br[] 줄바꿈\n\n:::',
			"**정적(Static)**과 **동적**",
			'::image{src="/images/a.png" alt="설명" width="60%"}',
		];
		if (bodyBlock && bodyAttribute) {
			const [name, attribute] = bodyAttribute;
			samples.push(
				`:::${directiveName(bodyBlock)}{${name}="${optionValue(attribute, "note")}"}\n\n본문 :u[밑줄] 과 :br[] 줄바꿈\n\n:::`,
			);
		}
		if (group) {
			const tabs = directiveName(group.block);
			const tab = directiveName(group.child);
			const label = (value: string) => {
				const props = childProps(group.child, value).trim();
				return props ? `{${props}}` : "";
			};
			samples.push(`::::${tabs}\n:::${tab}${label("a")}\nA\n:::\n:::${tab}${label("b")}\nB\n:::\n::::`);
		}
		if (markBlock && markAttribute) {
			samples.push(`문단 안의 :${directiveName(markBlock)}[라벨]{${markAttribute[0]}="설명"} 입니다.`);
		}

		for (const sample of samples) {
			expect(writeTwice(sample)).toBe(write(sample));
		}
	});
});
