import type { BlockAttribute, BlockDefinition } from "@monti-cms/core";
import { mdxWith } from "@monti-cms/mdx/testing";
import { describe, expect, it } from "vitest";
import { testSite } from "../../test/site";
import { directiveSyntax } from "..";

/**
 * Block names are looked up from the current config (runs with both the reference blog setup and another site's config). If the config has no such block, that case is
 * skipped. Core blocks (underline, superscript, image, center alignment etc.) exist in every config.
 */
const stringAttribute = (block: BlockDefinition | undefined): [string, BlockAttribute] | undefined =>
	block && Object.entries(block.attributes).find(([, attribute]) => attribute.type === "string");
/** A value that can go in that attribute (the first value if it has options). */
const optionValue = (attribute: BlockAttribute, fallback: string) =>
	attribute.options ? (Object.keys(attribute.options)[0] ?? fallback) : fallback;

/** A site block that holds body content (a container with no child rules or parent, e.g. a callout) and its text attribute. */
const bodyBlock = testSite.ADDED_BLOCKS.find(
	(block) => block.syntax.kind === "container" && !block.children?.blocks && !block.parent && stringAttribute(block),
);
const bodyAttribute = stringAttribute(bodyBlock);
/** A container block with a boolean attribute (e.g. a collapsible). */
const booleanBlock = testSite.ADDED_BLOCKS.find(
	(block) =>
		block.syntax.kind === "container" &&
		Object.values(block.attributes).some((attribute) => attribute.type === "boolean"),
);
const booleanAttribute = booleanBlock
	? Object.entries(booleanBlock.attributes).find(([, attribute]) => attribute.type === "boolean")?.[0]
	: undefined;
/** A text decoration block with a text attribute (e.g. a tooltip). */
const markBlock = testSite.ADDED_MARK_BLOCKS.find((block) => stringAttribute(block));
const markAttribute = stringAttribute(markBlock);
/** A group block that holds only specified child blocks, and its child (e.g. a tabs group and a tab, a column layout and a column). */
const groups = testSite.ADDED_BLOCKS.flatMap((block) => {
	const child = testSite.BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
	return block.syntax.kind === "container" && child?.syntax.kind === "container" ? [{ block, child }] : [];
});
/** JSX attributes of the child block (fill in only the required text attributes, e.g. the tab name). */
const childProps = (child: BlockDefinition, value: string) =>
	Object.entries(child.attributes)
		.filter(([, attribute]) => attribute.type === "string" && attribute.required)
		.map(([name]) => ` ${name}="${value}"`)
		.join("");
const directiveName = (block: BlockDefinition) => ("directive" in block.syntax ? block.syntax.directive : block.name);

/** Write path with the directive extension: `MDX → analyze → toDocument → serialize`. */
const { write, writeTwice } = mdxWith(testSite, [directiveSyntax()]);

describe("directive syntax: writing", () => {
	it("normalizes read-compatible JSX and inline HTML to directives", () => {
		expect(write("<u>밑줄</u>").trimEnd()).toBe(":u[밑줄]");
		expect(write("<sup>위</sup>").trimEnd()).toBe(":sup[위]");
		expect(write("<sub>아래</sub>").trimEnd()).toBe(":sub[아래]");
		expect(write('<TextAlign align="center">\n\n가운데\n\n</TextAlign>').trimEnd()).toBe(
			':::text-align{align="center"}\n가운데\n:::',
		);
	});

	it.skipIf(!bodyBlock || !bodyAttribute)("also normalizes JSX of a site container block to a directive", () => {
		if (!bodyBlock || !bodyAttribute) return;
		const { component } = bodyBlock;
		const [name, attribute] = bodyAttribute;
		const value = optionValue(attribute, "note");
		expect(write(`<${component} ${name}="${value}">\n\n본문\n\n</${component}>`).trimEnd()).toBe(
			`:::${directiveName(bodyBlock)}{${name}="${value}"}\n본문\n:::`,
		);
	});

	it.skipIf(!markBlock || !markAttribute)("also normalizes JSX of a site text decoration block to a directive", () => {
		if (!markBlock || !markAttribute) return;
		const [name] = markAttribute;
		expect(write(`<${markBlock.component} ${name}="설명">라벨</${markBlock.component}>`).trimEnd()).toBe(
			`:${directiveName(markBlock)}[라벨]{${name}="설명"}`,
		);
	});

	it.skipIf(groups.length < 2)("nested containers have more colons the further out they are (3 + level)", () => {
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

	it.skipIf(!bodyBlock)("a core container inside a site container: the outer one has more colons", () => {
		if (!bodyBlock) return;
		const { component } = bodyBlock;
		const nested = write(`<${component}>\n<TextAlign align="center">\n깊은 본문\n</TextAlign>\n</${component}>`);

		expect(nested).toContain(`::::${directiveName(bodyBlock)}`);
		expect(nested).toContain(':::text-align{align="center"}');
	});

	it.skipIf(!booleanBlock || !booleanAttribute)(
		"a boolean attribute writes its name only when true and omits false or missing",
		() => {
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
		},
	);

	it("writes JSX where Markdown emphasis does not hold", () => {
		// If the inner end is punctuation, CommonMark emphasis does not close and the asterisks stay as text.
		expect(write("<strong>정적(Static)</strong>과 동적").trimEnd()).toBe("<strong>정적(Static)</strong>과 동적");
		expect(write('<strong>"인용"</strong>').trimEnd()).toBe('<strong>"인용"</strong>');
		// Where it holds, Markdown is kept as is.
		expect(write("<strong>정적</strong>과 동적").trimEnd()).toBe("**정적**과 동적");
		expect(write("<em>기울임</em>").trimEnd()).toBe("*기울임*");
		expect(write("<del>취소</del>").trimEnd()).toBe("~~취소~~");
		// Input where emphasis does not hold does not leave asterisks as text (they are escaped).
		expect(write("**정적(Static)**과 동적").trimEnd()).toBe("\\*\\*정적(Static)\\*\\*과 동적");
	});

	it("does not write line breaks as directives (always <br />)", () => {
		expect(write("첫 줄\\\n둘째 줄")).toBe("첫 줄<br />\n둘째 줄\n");
		expect(write("앞:br[]뒤")).toBe("앞<br />\n뒤\n");
	});

	it("writes an image as a leaf if it has a media reference, size, alignment, caption or decorative flag, otherwise as Markdown", () => {
		expect(write('<Image mediaId="uuid-1" alt="설명" />').trimEnd()).toBe('::image{mediaId="uuid-1" alt="설명"}');
		expect(write('<Image src="/images/a.png" alt="설명" width="60%" align="center" caption="캡션" />').trimEnd()).toBe(
			'::image{src="/images/a.png" alt="설명" width="60%" align="center" caption="캡션"}',
		);
		expect(write('<Image src="/images/a.png" alt="설명" decorative />').trimEnd()).toBe(
			'::image{src="/images/a.png" alt="설명" decorative}',
		);
		expect(write("![설명](/images/a.png)").trimEnd()).toBe("![설명](/images/a.png)");
	});

	it("keeps an escaped `:name` as text", () => {
		// If a delimiter follows a registered name it is read as a directive, so it is cut with `\:`.
		expect(write("글자로 쓰는 \\:u[괄호] 예문").trimEnd()).toBe("글자로 쓰는 \\:u\\[괄호] 예문");
		expect(write("줄바꿈 글자 \\:br 입니다").trimEnd()).toBe("줄바꿈 글자 \\:br 입니다");
		expect(write("자물쇠 \\:\\:image{alt=x} 글자").trimEnd()).toBe("자물쇠 :\\:image{alt=x} 글자");
		// Colons in unregistered names, times and URLs are left alone.
		expect(write("벡터 rag openai/gpt-oss-120b:free를 쓴다").trimEnd()).toBe(
			"벡터 rag openai/gpt-oss-120b:free를 쓴다",
		);
		expect(write("낮 12:30에 만나요").trimEnd()).toBe("낮 12:30에 만나요");
	});

	it("writing the written string again gives the same string (idempotent)", () => {
		const [group] = groups;
		const samples = [
			':::text-align{align="center"}\n\n본문 :u[밑줄] 과 줄바꿈\n\n:::',
			"**정적(Static)**과 **동적**",
			'::image{src="/images/a.png" alt="설명" width="60%"}',
		];
		if (bodyBlock && bodyAttribute) {
			const [name, attribute] = bodyAttribute;
			samples.push(
				`:::${directiveName(bodyBlock)}{${name}="${optionValue(attribute, "note")}"}\n\n본문 :u[밑줄] 과 줄바꿈\n\n:::`,
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
