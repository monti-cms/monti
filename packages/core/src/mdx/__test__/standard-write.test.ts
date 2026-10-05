import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS, ADDED_MARK_BLOCKS } from "../../blocks/active";
import type { BlockDefinition } from "../../blocks/define";
import { computeContentHash } from "../../core/content-hash";
import { analyze, serialize, toDocument } from "..";

/**
 * The standard notation: with no syntax extension, saved MDX is CommonMark + GFM + standard MDX JSX. Blocks are read from the current config
 * (the test runs with both the reference blog setup and another site's config), so no block name is hard-coded except the core ones.
 */

/** Write path: `MDX → analyze → toDocument → serialize`. */
const write = (source: string): string => serialize(toDocument(analyze(source)));

/** The document a body means. A line break is one node whichever way it was spelled, so no normalising is needed here. */
const meaning = (source: string) => JSON.stringify(toDocument(analyze(source)));

const DIRECTIVE_NOTATION = /^:{2,}[a-z]|[^\\]:[a-z-]+\[/m;

describe("standard MDX output", () => {
	describe("line breaks", () => {
		it("are always written as <br /> whichever way they were read", () => {
			const written = "첫 줄<br />\n둘째 줄\n";
			expect(write("첫 줄\\\n둘째 줄")).toBe(written);
			expect(write("첫 줄  \n둘째 줄")).toBe(written);
			expect(write("첫 줄<br />둘째 줄")).toBe(written);
			expect(write(written)).toBe(written);
		});

		it("are one node in the document whichever way they were spelled", () => {
			const spellings = ["가<br />나", "가<br/>나", "가\\\n나", "가  \n나", "가<br />\n나"];
			const documents = spellings.map((source) => toDocument(analyze(source)));
			for (const document of documents) expect(document).toEqual(documents[0]);
			expect(documents[0]?.content?.[0]?.content?.map((node) => node.type)).toEqual(["text", "hardBreak", "text"]);
		});

		it("have the same content hash whichever way they were spelled", () => {
			const hash = (source: string) => computeContentHash({ title: "t" }, source);
			expect(hash("가<br />나")).toBe(hash("가\\\n나"));
			expect(hash("**가<br />나**")).toBe(hash("**가\\\n나**"));
			// The serializer closes marks before a break, so a re-save must not change the hash either.
			expect(hash("**가<br />나**")).toBe(hash(write("**가<br />나**")));
		});

		it("do not change what the body means", () => {
			expect(meaning("가<br />나")).toBe(meaning("가<br />\n나"));
			expect(meaning("가\\\n나")).toBe(meaning(write("가\\\n나")));
		});

		it("stay inline in headings and table cells", () => {
			expect(write("## 제목<br />둘째").trimEnd()).toBe("## 제목<br />둘째");
			expect(write("| a | b |\n| - | - |\n| x<br />y | z |\n").trimEnd()).toBe(
				"| a | b |\n| --- | --- |\n| x<br />y | z |",
			);
		});

		it("keep a continuation line indented inside a list item", () => {
			const written = write("- 첫 줄\\\n  둘째 줄\n- 다음");
			expect(written).toBe("- 첫 줄<br />\n  둘째 줄\n- 다음\n");
			expect(write(written)).toBe(written);
		});

		it("keep text that starts a line from being read as another block", () => {
			for (const next of ["# 제목", "- 항목", "1. 항목", "> 인용", "---", "```"]) {
				const written = write(`가\\\n\\${next}`);
				expect(written, next).toContain("<br />\n\\");
				expect(write(written), next).toBe(written);
				expect(meaning(written), next).toBe(meaning(`가\\\n\\${next}`));
			}
		});

		it("never leave a line of only <br />, which would be read as a block", () => {
			const written = write("가<br /><br />나");
			expect(written).toBe("가<br /><br />\n나\n");
			expect(meaning(written)).toBe(meaning("가<br /><br />나"));
		});

		it("do not drop the content of a br element that holds some", () => {
			expect(write("앞 <br>안쪽</br> 뒤")).toContain("안쪽");
		});

		it("do not drop the attributes of a br element, which is not a plain break", () => {
			const written = write('앞<br className="x" />뒤');
			expect(written).toContain('className="x"');
			expect(write(written)).toBe(written);
			expect(toDocument(analyze('앞<br className="x" />뒤')).content?.[0]?.content?.map((node) => node.type)).toEqual([
				"text",
				"mdxJsx",
				"text",
			]);
		});

		it("keep a paragraph of only a break as that paragraph", () => {
			const doc = toDocument(analyze("앞\n\n<br />\n\n뒤"));
			expect(doc.content?.map((node) => node.type)).toEqual(["paragraph", "paragraph", "paragraph"]);
			expect(write("앞\n\n<br />\n\n뒤")).toBe("앞\n\n<br />\n\n뒤\n");
		});
	});

	describe("text marks and core blocks", () => {
		it("writes underline, superscript, subscript and the untranslated hint as elements", () => {
			const body = "<u>밑줄</u> <sup>위</sup> <sub>아래</sub> <Untranslated>원문</Untranslated>\n";
			expect(write(body)).toBe(body);
		});

		it("writes text alignment as an element", () => {
			const body = '<TextAlign align="center">\n\n가운데\n\n</TextAlign>\n';
			expect(write(body)).toBe(body);
		});

		it("writes a media image or an image with extras as an element and a plain image as Markdown", () => {
			expect(write('<Image mediaId="uuid-1" alt="설명" />\n')).toBe('<Image mediaId="uuid-1" alt="설명" />\n');
			expect(write('<Image src="/a.png" alt="설명" width="60%" caption="캡션" />\n')).toBe(
				'<Image src="/a.png" alt="설명" width="60%" caption="캡션" />\n',
			);
			expect(write("![설명](/a.png)\n")).toBe("![설명](/a.png)\n");
			expect(write('![설명](/a.png "제목")\n')).toBe('![설명](/a.png "제목")\n');
		});

		it("writes a file card as an element", () => {
			const body = '<File mediaId="uuid-2" label="자료" />\n';
			expect(write(body)).toBe(body);
		});

		it("writes a table GFM cannot express as elements and any other table as GFM", () => {
			const merged = [
				"<Table>",
				"<TableRow>",
				'<TableCell header colspan="2">제목</TableCell>',
				"</TableRow>",
				"<TableRow>",
				"<TableCell>가</TableCell>",
				"<TableCell>나</TableCell>",
				"</TableRow>",
				"</Table>",
				"",
			].join("\n");
			expect(write(merged)).toBe(merged);
			expect(DIRECTIVE_NOTATION.test(write(merged))).toBe(false);
			const gfm = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";
			expect(write(gfm)).toBe(gfm);
		});

		it("keeps `:name` text as ordinary text, with no `\\:` escape", () => {
			const body = "시각 12:30 과 :u 와 :::callout 은 그냥 글자다\n";
			expect(write(body)).toBe(body);
			expect(write("글자 :u[괄호] 와 ::image 예문")).not.toContain("\\:");
		});
	});

	describe("blocks of the config", () => {
		const attributeText = (block: BlockDefinition) =>
			Object.entries(block.attributes)
				.flatMap(([name, attribute]) => {
					if (attribute.type === "boolean") return [name];
					const value = attribute.options
						? Object.keys(attribute.options)[0]
						: attribute.required
							? "value"
							: undefined;
					return value === undefined ? [] : [`${name}="${value}"`];
				})
				.join(" ");
		const open = (block: BlockDefinition) =>
			`${block.component}${attributeText(block) ? ` ${attributeText(block)}` : ""}`;

		const container = ADDED_BLOCKS.find(
			(block) => block.syntax.kind === "container" && !block.children && !block.parent,
		);
		const mark = ADDED_MARK_BLOCKS.find((block) => !block.children);
		const group = ADDED_BLOCKS.flatMap((block) => {
			const child = ADDED_BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
			return child && block.syntax.kind === "container" ? [{ block, child }] : [];
		})[0];

		it.skipIf(!container)("writes a container block as an element holding its body", () => {
			if (!container) return;
			const body = `<${open(container)}>\n\n본문 <u>밑줄</u>\n\n</${container.component}>\n`;
			expect(analyze(body).errors).toEqual([]);
			expect(write(body)).toBe(body);
		});

		it.skipIf(!mark)("writes a text block as an element around the text", () => {
			if (!mark) return;
			const body = `앞 <${open(mark)}>라벨</${mark.component}> 뒤\n`;
			expect(analyze(body).errors).toEqual([]);
			expect(write(body)).toBe(body);
		});

		it.skipIf(!group || !container)("nests containers without any delimiter counting", () => {
			if (!group || !container) return;
			const { block, child } = group;
			const body = [
				`<${open(block)}>`,
				"",
				`<${open(child)}>`,
				"",
				`<${open(container)}>`,
				"",
				"깊은 본문",
				"",
				`</${container.component}>`,
				"",
				`</${child.component}>`,
				"",
				`<${open(child)}>`,
				"",
				"둘째",
				"",
				`</${child.component}>`,
				"",
				`</${block.component}>`,
				"",
			].join("\n");
			expect(analyze(body).errors).toEqual([]);
			expect(write(body)).toBe(body);
		});

		it("writes no directive notation for any block", () => {
			const blocks = [container, mark, group?.block].filter((block): block is BlockDefinition => Boolean(block));
			for (const block of blocks) {
				const source =
					block.syntax.kind === "text"
						? `가 <${open(block)}>나</${block.component}> 다\n`
						: `<${open(block)}>\n\n본문\n\n</${block.component}>\n`;
				const written = write(source);
				expect(DIRECTIVE_NOTATION.test(written), block.name).toBe(false);
			}
		});

		it("omits a false boolean attribute and writes a true one bare", () => {
			const boolean = ADDED_BLOCKS.find(
				(block) =>
					block.syntax.kind === "container" &&
					!block.children &&
					!block.parent &&
					Object.values(block.attributes).some((attribute) => attribute.type === "boolean"),
			);
			if (!boolean) return;
			const name = Object.entries(boolean.attributes).find(([, attribute]) => attribute.type === "boolean")?.[0] ?? "";
			const required = Object.entries(boolean.attributes)
				.filter(([, attribute]) => attribute.required && attribute.type !== "boolean")
				.map(([key]) => ` ${key}="x"`)
				.join("");
			const block = (props: string) => `<${boolean.component}${required}${props}>\n\n본문\n\n</${boolean.component}>\n`;
			expect(write(block(` ${name}`))).toBe(block(` ${name}`));
			expect(write(block(` ${name}="false"`))).toBe(block(""));
			expect(write(block(""))).toBe(block(""));
		});
	});

	describe("writing again", () => {
		it("gives the same string", () => {
			const samples = [
				"가<br />\n나 **굵게** <u>밑줄</u>\n\n- 목록<br />\n  이어짐\n\n> 인용\n",
				'<TextAlign align="right">\n\n오른쪽<br />\n줄바꿈\n\n</TextAlign>\n',
				'<Image mediaId="m" alt="a" />\n\n<File mediaId="f" />\n',
			];
			for (const sample of samples) {
				expect(write(write(sample)), sample).toBe(write(sample));
			}
		});
	});
});
