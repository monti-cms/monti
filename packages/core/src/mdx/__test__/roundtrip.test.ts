import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS, BLOCKS } from "../../blocks/active";
import type { BlockDefinition } from "../../blocks/define";
import { analyze, serialize, toDocument } from "..";
import { readSample, SAMPLES_DIR } from "./fixtures/samples";

/**
 * Site block names are looked up from the current config (runs with both the reference blog setup and another site's config). If the config has no such block,
 * that case is skipped (e.g. another site's config has no group blocks such as a tabs group, and no boolean-attribute block).
 */
const stringAttributes = (block: BlockDefinition) =>
	Object.entries(block.attributes).filter(([, attribute]) => attribute.type === "string");
/** A site block that holds body content (a container with no child rules or parent, e.g. a callout). */
const bodyBlock = ADDED_BLOCKS.find(
	(block) => block.syntax.kind === "container" && !block.children?.blocks && !block.parent,
);
/** A group block that holds only specified child blocks, its child, and the child count range (e.g. a tabs group and 2 to 8 tabs, a column layout and 2 to 4 columns). */
const groups = ADDED_BLOCKS.flatMap((block) => {
	const child = BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
	const { min, max } = block.children ?? {};
	return block.syntax.kind === "container" && child && min && max !== undefined ? [{ block, child, min, max }] : [];
});
/** A container block with a boolean attribute (e.g. a collapsible) and that attribute's name. */
const booleanBlock = ADDED_BLOCKS.find(
	(block) =>
		block.syntax.kind === "container" &&
		Object.values(block.attributes).some((attribute) => attribute.type === "boolean"),
);
const booleanAttribute = booleanBlock
	? Object.entries(booleanBlock.attributes).find(([, attribute]) => attribute.type === "boolean")?.[0]
	: undefined;

/** Opening tag of a block's JSX. Fills text attributes with values in order (one of the options if it has any). */
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
/** Child JSX of a group (fill in only the required text attributes, e.g. the tab name). */
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

describe("MDX round trip: analyze → toDocument → serialize → analyze", () => {
	describe("code fences and annotation metadata", () => {
		it("language, title, lnum and the content, whitespace and ranges of @char/@line annotations are kept without loss", () => {
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

		it("overlapping annotation emphasis (two @char) does not disappear either", () => {
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

		it("plain code fence content is preserved and not changed into editor-only syntax", () => {
			const mdx = "```ts\nconst a = 1\n```";
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("const a = 1");
		});

		it("the meaning of whitespace and indentation inside code is kept", () => {
			const mdx = ["```ts", "  const indented = true", "\tconst tabbed = true", "```"].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("indented");
			expect(text).toContain("tabbed");
		});
	});

	describe("nested JSX components", () => {
		it.skipIf(!groups[0])("group > child > code fence > annotation keeps the meaning of the nested structure", () => {
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

		it.skipIf(!bodyBlock)("container > code fence and a container inside a container are also kept", () => {
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

		it.skipIf(!bodyBlock || groups.length < 2)(
			"Tabs inside Callout and Callout inside Columns are not lost either",
			() => {
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
				// Attribute values (for a callout, the kind note/info and the title) are kept too.
				const [kind, title] = stringAttributes(bodyBlock);
				const options = kind?.[1].options;
				const optionValue = (value: string) => (options && !(value in options) ? Object.keys(options)[0] : value);
				if (kind) expect(text).toContain(optionValue("note"));
				if (kind) expect(text).toContain(optionValue("info"));
				if (title) expect(text).toContain("안쪽 콜아웃");
			},
		);

		it.skipIf(!booleanBlock || !booleanAttribute)("literal attributes such as defaultOpen={true} are kept", () => {
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

		// Reference blog setup: tabs group (2 to 8) and column layout (2 to 4).
		it.skipIf(groups.length === 0)(
			"group child count boundary: min-1 and max+1 are blocked as errors, min and max are allowed",
			() => {
				for (const { block, child, min, max } of groups) {
					const groupOf = (count: number) =>
						`${open(block)}${Array.from({ length: count }, (_, i) => `${openChild(child, `${i + 1}`)}a${close(child)}`).join("")}${close(block)}`;

					fullRoundtrip(groupOf(min));
					fullRoundtrip(groupOf(max));
					expect(analyze(groupOf(min - 1), `too-few-${block.name}`).errors ?? []).not.toEqual([]);
					expect(analyze(groupOf(max + 1), `too-many-${block.name}`).errors ?? []).not.toEqual([]);
				}
			},
		);
	});

	describe("tables", () => {
		const TABLE = [
			"행렬 | 시간 복잡도 | 비고",
			"--- | --- | ---",
			"A | O(log n) | 정렬 보조",
			"B | O(n log n) | 하한 경계",
		].join("\n");

		it("cell text and column structure are not lost", () => {
			const text = JSON.stringify(fullRoundtrip(TABLE).secondDoc);
			expect(text).toContain("행렬");
			expect(text).toContain("O(n log n)");
			expect(text).toContain("하한 경계");
		});

		it("a | inside a code block is not interpreted as a table", () => {
			const mdx = ["```ts", 'if (a) { return "|" }', "```", "", "행렬 | 값", "--- | ---", "x | 1"].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			// JSON.stringify escapes quotes inside the fence value (`return \"|\"`).
			expect(text).toContain("return");
			expect(text).toContain("|");
			expect(text).toContain("x");
			expect(text).toContain("1");
		});
	});

	describe("block math", () => {
		it("the content of a $$...$$ block math is not lost", () => {
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

		it("SQL as $$ inside a code fence is not turned into block math", () => {
			const mdx = ["```sql", "language plpgsql", "as $$", "begin return query; end;", "$$;", "```"].join("\n");
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("$");
			expect(text).toContain("begin return query; end;");
		});
	});

	describe("raw source toggle", () => {
		it("toggling view only does not call serialize and the raw source bytes are kept", () => {
			for (const name of readdirSync(SAMPLES_DIR)) {
				const source = readSample(name);
				const analysis = analyze(source);
				expect(analysis.source).toBe(source);
			}
		});

		it("analyze.source of arbitrary raw source also equals the original string", () => {
			const mdx = "## 주제\n\n문단이다.\n";
			expect(analyze(mdx, "toggle").source).toBe(mdx);
		});
	});

	describe("unsupported syntax and errors", () => {
		it("a spread attribute shows the error position and does not delete the source", () => {
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

		it("a function call attribute is rejected and the source is preserved", () => {
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

		it("a document with unsupported syntax is not lost in the visual conversion", () => {
			const mdx = "<TemplateImport value={{a: 1}}>x</TemplateImport>";
			const analysis = analyze(mdx, "unsupported-doc");
			const firstDoc = toDocument(analysis);
			expect(analysis.source).toContain("<TemplateImport");
			expect(JSON.stringify(firstDoc)).toContain("x");
		});

		it("an unknown code language keeps its content", () => {
			const mdx = "```madeup\nabstract sealed class Thing\n```";
			const text = JSON.stringify(fullRoundtrip(mdx).secondDoc);
			expect(text).toContain("sealed class");
		});
	});

	describe("metadata", () => {
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

		it("frontmatter values are not lost in the round trip", () => {
			const text = JSON.stringify(fullRoundtrip(FRONT).secondDoc);
			expect(text).toContain("loadFile");
			expect(text).toContain("typescript");
			expect(text).toContain("normal");
		});
	});
});
