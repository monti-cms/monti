import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS, BLOCKS } from "../../blocks/active";
import type { BlockDefinition } from "../../blocks/define";
import { analyze, serialize, toDocument } from "..";
import { readSample, SAMPLES_DIR } from "./fixtures/samples";

/**
 * 사이트 블록 이름은 지금 설정에서 찾는다(블로그 예시 설정과 다른 사이트 설정 둘 다로 돈다). 설정에 그런 블록이 없으면
 * 그 경우는 건너뛴다(예: 다른 사이트 설정에는 탭 묶음 같은 묶음 블록과 불리언 속성 블록이 없다).
 */
const stringAttributes = (block: BlockDefinition) =>
	Object.entries(block.attributes).filter(([, attribute]) => attribute.type === "string");
/** 본문을 담는 사이트 블록(자식 규칙·부모가 없는 컨테이너, 예: 콜아웃). */
const bodyBlock = ADDED_BLOCKS.find(
	(block) => block.syntax.kind === "container" && !block.children?.blocks && !block.parent,
);
/** 정해진 자식 블록만 담는 묶음 블록과 그 자식, 자식 개수 범위(예: 탭 묶음·탭 2~8개, 단 나누기·단 2~4개). */
const groups = ADDED_BLOCKS.flatMap((block) => {
	const child = BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
	const { min, max } = block.children ?? {};
	return block.syntax.kind === "container" && child && min && max !== undefined ? [{ block, child, min, max }] : [];
});
/** 불리언 속성이 있는 컨테이너 블록(예: 접기)과 그 속성 이름. */
const booleanBlock = ADDED_BLOCKS.find(
	(block) =>
		block.syntax.kind === "container" &&
		Object.values(block.attributes).some((attribute) => attribute.type === "boolean"),
);
const booleanAttribute = booleanBlock
	? Object.entries(booleanBlock.attributes).find(([, attribute]) => attribute.type === "boolean")?.[0]
	: undefined;

/** 블록 JSX 여는 태그. 글 속성에 차례로 값을 넣는다(선택 값이 있으면 그중 하나). */
const open = (block: BlockDefinition, ...values: string[]) => {
	const props = stringAttributes(block)
		.slice(0, values.length)
		.map(([name, attribute], index) => {
			const options = attribute.options ? Object.keys(attribute.options) : [];
			const value = options.length > 0 ? (options.find((key) => key === values[index]) ?? options[0]) : values[index];
			return ` ${name}="${value}"`;
		})
		.join("");
	return `<${block.component}${props}>`;
};
const close = (block: BlockDefinition) => `</${block.component}>`;
/** 묶음의 자식 JSX(필수 글 속성만 채운다, 예: 탭 이름). */
const openChild = (child: BlockDefinition, value: string) => {
	const props = stringAttributes(child)
		.filter(([, attribute]) => attribute.required)
		.map(([name]) => ` ${name}="${value}"`)
		.join("");
	return `<${child.component}${props}>`;
};

function fullRoundtrip(mdx: string): { firstDoc: unknown; secondDoc: unknown } {
	const first = analyze(mdx);
	const firstDoc = toDocument(first);
	const serialized = serialize(firstDoc);
	const second = analyze(serialized);
	const secondDoc = toDocument(second);
	expect(second.errors ?? []).toEqual(first.errors ?? []);
	return { firstDoc, secondDoc };
}

const CODE_ANNOTATION_FENCE = [
	'```ts title="라인 범위 annotation 예시" lnum',
	"const greeting = 'hi'",
	'// @char Tooltip {0-5} content="인사말"   ',
	"// @line collapse",
	"export async function generateImageMetadata() {",
	"// @line collapse end",
	"  return gathering",
	"}",
].join("\n");

describe("MDX 왕복: analyze → toDocument → serialize → analyze", () => {
	describe("코드 펜스와 주석 메타데이터", () => {
		it("언어·title·lnum과 @char/@line 주석의 내용·공백·범위가 유실 없이 유지된다", () => {
			const { secondDoc } = fullRoundtrip(CODE_ANNOTATION_FENCE);
			const text = JSON.stringify(secondDoc);
			expect(text).toContain("라인 범위 annotation 예시");
			// JSON.stringify escapes quotes, so the MDX literal content="인사말" cannot appear verbatim.
			expect(text).toContain("인사말");
			expect(text).toContain("content");
			expect(text).toContain("@line collapse");
			expect(text).toContain("@char Tooltip {0-5}");
			expect(text).toContain("lnum");
		});

		it("주석 강조 겹침(@char 두 개)도 사라지지 않는다", () => {
			const mdx = [
				"```ts",
				'// @char Tooltip {0-7} content="첫째"',
				'// @char Tooltip {3-9} content="둘째"',
				"User-Agent: *",
				"```",
			].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("{0-7}");
			expect(text).toContain("{3-9}");
			expect(text).toContain("첫째");
			expect(text).toContain("둘째");
		});

		it("일반 코드 펜스 내용이 보존되고 에디터 전용 문법으로 바뀌지 않는다", () => {
			const mdx = "```ts\nconst a = 1\n```";
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("const a = 1");
		});

		it("코드 안의 공백·들여쓰기 의미가 유지된다", () => {
			const mdx = ["```ts", "  const indented = true", "\tconst tabbed = true", "```"].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("indented");
			expect(text).toContain("tabbed");
		});
	});

	describe("중첩 JSX 컴포넌트", () => {
		it.skipIf(!groups[0])("묶음 > 자식 > 코드 펜스 > 주석이 중첩 구조의 의미를 유지한다", () => {
			const [group] = groups;
			if (!group) return;
			const { block: tabs, child: tab } = group;
			const nested = [
				open(tabs),
				`  ${openChild(tab, "robots.txt")}`,
				'    ```text title="src/app/robots.txt"',
				"    User-Agent: *",
				"    ```",
				`  ${close(tab)}`,
				`  ${openChild(tab, "sitemap.ts")}`,
				"    sitemap.ts 문단은 펜스 뒤에도 온다.",
				`  ${close(tab)}`,
				close(tabs),
			].join("\n");
			const text = JSON.stringify(fullRoundtrip(nested).secondDoc);
			expect(text).toContain("robots.txt");
			expect(text).toContain("sitemap.ts");
			expect(text).toContain("User-Agent: *");
		});

		it.skipIf(!bodyBlock)("컨테이너 > 코드 펜스와 컨테이너 안의 컨테이너도 유지된다", () => {
			if (!bodyBlock) return;
			const mdx = [
				open(bodyBlock, "note"),
				'  ```text title="src/app/robots.txt"',
				"  User-Agent: *",
				"  ```",
				`  ${open(bodyBlock, "info", "안쪽 블록")}`,
				"    안쪽 문단이다.",
				`  ${close(bodyBlock)}`,
				close(bodyBlock),
			].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("robots.txt");
			expect(text).toContain("User-Agent: *");
			expect(text).toContain("안쪽 문단이다.");
		});

		it.skipIf(!bodyBlock || groups.length < 2)("Callout 안의 Tabs, Columns 안의 Callout도 유실되지 않는다", () => {
			const [first, second] = groups;
			if (!bodyBlock || !first || !second) return;
			const { block: tabs, child: tab } = first;
			const { block: columns, child: column } = second;
			const mdx = [
				open(bodyBlock, "note"),
				`  ${open(tabs)}`,
				`    ${openChild(tab, "a")}바깥 Tab a${close(tab)}`,
				`    ${openChild(tab, "b")}바깥 Tab b${close(tab)}`,
				`  ${close(tabs)}`,
				close(bodyBlock),
				"",
				open(columns),
				`  ${openChild(column, "c")}`,
				`    ${open(bodyBlock, "info", "안쪽 콜아웃")}`,
				"      컬럼 안 문단이다.",
				`    ${close(bodyBlock)}`,
				`  ${close(column)}`,
				`  ${openChild(column, "d")}두 번째 컬럼${close(column)}`,
				close(columns),
			].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("컬럼 안 문단이다.");
			expect(text).toContain("바깥 Tab a");
			expect(text).toContain("두 번째 컬럼");
			// 속성 값(콜아웃이면 종류 note·info와 제목)도 남는다.
			const [kind, title] = stringAttributes(bodyBlock);
			const options = kind?.[1].options;
			const optionValue = (value: string) => (options && !(value in options) ? Object.keys(options)[0] : value);
			if (kind) expect(text).toContain(optionValue("note"));
			if (kind) expect(text).toContain(optionValue("info"));
			if (title) expect(text).toContain("안쪽 콜아웃");
		});

		it.skipIf(!booleanBlock || !booleanAttribute)("defaultOpen={true} 같은 리터럴 속성이 유지된다", () => {
			if (!booleanBlock || !booleanAttribute) return;
			const mdx = [
				`<${booleanBlock.component} ${booleanAttribute}={true}>`,
				"펼친 상태로 저장된다.",
				close(booleanBlock),
			].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain(booleanAttribute);
			expect(text).toContain("true");
		});

		// 블로그 예시 설정: 탭 묶음(2~8개)·단 나누기(2~4개).
		it.skipIf(groups.length === 0)("묶음 자식 개수 경계: 최소-1·최대+1은 오류로 차단하고 최소·최대는 허용한다", () => {
			for (const { block, child, min, max } of groups) {
				const groupOf = (count: number) =>
					`${open(block)}${Array.from({ length: count }, (_, i) => `${openChild(child, `${i + 1}`)}a${close(child)}`).join("")}${close(block)}`;

				fullRoundtrip(groupOf(min));
				fullRoundtrip(groupOf(max));
				expect(analyze(groupOf(min - 1), `too-few-${block.name}`).errors ?? []).not.toEqual([]);
				expect(analyze(groupOf(max + 1), `too-many-${block.name}`).errors ?? []).not.toEqual([]);
			}
		});
	});

	describe("표", () => {
		const TABLE = [
			"행렬 | 시간 복잡도 | 비고",
			"--- | --- | ---",
			"A | O(log n) | 정렬 보조",
			"B | O(n log n) | 하한 경계",
		].join("\n");

		it("셀 텍스트·열 구조가 유실되지 않는다", () => {
			const text = JSON.stringify(fullRoundtrip(TABLE).secondDoc);
			expect(text).toContain("행렬");
			expect(text).toContain("O(n log n)");
			expect(text).toContain("하한 경계");
		});

		it("코드블럭 안의 | 는 표로 해석되지 않는다", () => {
			const mdx = ["```ts", 'if (a) { return "|" }', "```", "", "행렬 | 값", "--- | ---", "x | 1"].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			// JSON.stringify escapes quotes inside the fence value (`return \"|\"`).
			expect(text).toContain("return");
			expect(text).toContain("|");
			expect(text).toContain("x");
			expect(text).toContain("1");
		});
	});

	describe("블록 수식", () => {
		it("$$...$$ 블록 수식의 내용이 유실되지 않는다", () => {
			const mdx = [
				"태스크 큐는 <u>비동기 작업이 완료된 후</u> 순서대로 실행된다.",
				"",
				"$$",
				"\\text{마이크로태스트 큐} > \\text{애니메이션 콜백 큐} > \\text{매크로태스크 큐}",
				"$$",
			].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("마이크로태스트 큐");
			expect(text).toContain("매크로태스크 큐");
		});

		it("코드 펜스 안의 SQL as $$ 는 블록 수식으로 바뀌지 않는다", () => {
			const mdx = ["```sql", "language plpgsql", "as $$", "begin return query; end;", "$$;", "```"].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("$");
			expect(text).toContain("begin return query; end;");
		});
	});

	describe("원문 토글(§4.4)", () => {
		it("보기만 토글하면 serialize를 호출하지 않고 원문 바이트가 유지된다", () => {
			for (const name of readdirSync(SAMPLES_DIR)) {
				const source = readSample(name);
				const analysis = analyze(source);
				expect(analysis.source).toBe(source);
			}
		});

		it("임의 원문의 analyze.source도 원래 문자열과 같다", () => {
			const mdx = "## 주제\n\n문단이다.\n";
			expect(analyze(mdx, "toggle").source).toBe(mdx);
		});
	});

	describe("미지원 문법·오류(§4.4)", () => {
		it("spread 속성은 오류 위치를 표시하고 원문을 삭제하지 않는다", () => {
			const box = bodyBlock?.component ?? "TextAlign";
			const mdx = ["# 미지원", "", `<${box} {...props}>내용</${box}>`].join("\n");
			const analysis = analyze(mdx, "spread-props");
			expect(analysis.errors ?? []).not.toEqual([]);
			const hasPosition = (analysis.errors ?? []).some(
				(error: { position: { line: number } }) => (error.position?.line ?? 0) >= 1,
			);
			expect(hasPosition).toBe(true);
			expect(analysis.source).toContain("{...props}");
			expect(analysis.source).toContain("내용");
		});

		it("함수 호출 속성은 거부되고 원문은 보존된다", () => {
			const [group] = groups;
			const mdx = group
				? [
						`<${group.block.component} onChange={handle}>`,
						`${openChild(group.child, "a")}x${close(group.child)}`,
						`${openChild(group.child, "b")}y${close(group.child)}`,
						close(group.block),
					].join("\n")
				: `<${bodyBlock?.component ?? "TextAlign"} onChange={handle}>x</${bodyBlock?.component ?? "TextAlign"}>`;
			const analysis = analyze(mdx, "fn-prop");
			expect(analysis.errors ?? []).not.toEqual([]);
			expect(analysis.source).toContain("onChange={handle}");
		});

		it("미지원 문법이 포함된 문서는 시각 변환에서 유실되지 않는다", () => {
			const mdx = "<TemplateImport value={{a: 1}}>x</TemplateImport>";
			const analysis = analyze(mdx, "unsupported-doc");
			const firstDoc = toDocument(analysis);
			expect(analysis.source).toContain("<TemplateImport");
			expect(JSON.stringify(firstDoc)).toContain("x");
		});

		it("알 수 없는 코드 언어는 내용을 보존한다", () => {
			const mdx = "```madeup\nabstract sealed class Thing\n```";
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("sealed class");
		});
	});

	describe("메타데이터", () => {
		const FRONT = [
			"---",
			"title: loadFile",
			"status: published",
			"publishedDateTimeISO: 2025-08-07T19:17:00.000Z",
			"tags:",
			"  - typescript",
			"  - snippets",
			"policy:",
			"  discriminant: normal",
			"---",
			"",
			"## loadFile",
			"",
			"본문이다.",
		].join("\n");

		it("frontmatter 값이 왕복에서 유실되지 않는다", () => {
			const text = JSON.stringify(fullRoundtrip(FRONT).secondDoc);
			expect(text).toContain("loadFile");
			expect(text).toContain("typescript");
			expect(text).toContain("normal");
		});
	});
});
