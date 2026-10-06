import type { BlockAttribute, BlockDefinition } from "@monti-cms/core";
import { ADDED_BLOCKS, ADDED_MARK_BLOCKS } from "@monti-cms/core/client";
import { analyze } from "@monti-cms/mdx/format";
import { describe, expect, it } from "vitest";
import { hashOf } from "../../test/hash";
import { mdxWith } from "../../test/mdx-syntax";
import { directiveSyntax } from "..";

/**
 * A site that has content in directive notation reads it with `directiveSyntax({ write: false })` and saves standard MDX.
 * Migration must not change what any post means: the content hash (of the parsed body) is the same before and after.
 */

const readOnly = [directiveSyntax({ write: false })];
const { write, writeTwice } = mdxWith(readOnly);

const metadata = { title: "A" };
const hashBefore = (mdx: string) => hashOf(metadata, mdx, 1, readOnly);
/** The written body is read with no extension at all: it is standard MDX. */
const hashAfter = (mdx: string) => hashOf(metadata, mdx, 1);

const DIRECTIVE_NOTATION = /^:{2,}[a-z]|[^\\]:[a-z-]+\[/m;

const value = (attribute: BlockAttribute) =>
	attribute.options ? (Object.keys(attribute.options)[0] ?? "x") : attribute.required ? "value" : undefined;
const braces = (block: BlockDefinition) => {
	const parts = Object.entries(block.attributes).flatMap(([name, attribute]) => {
		if (attribute.type === "boolean") return [name];
		const given = value(attribute);
		return given === undefined ? [] : [`${name}="${given}"`];
	});
	return parts.length > 0 ? `{${parts.join(" ")}}` : "";
};

/** Directive spelling of blocks the config adds (a container, a leaf and a text mark, when it has them). */
const addedBlocks = (): string[] => {
	const lines: string[] = [];
	const container = ADDED_BLOCKS.find((block) => block.syntax.kind === "container" && !block.children && !block.parent);
	const leaf = ADDED_BLOCKS.find((block) => block.syntax.kind === "leaf" && !block.parent);
	const mark = ADDED_MARK_BLOCKS.find((block) => !block.children);
	if (container && container.syntax.kind === "container") {
		lines.push(`:::${container.syntax.directive}${braces(container)}\n안쪽 :u[밑줄]\n:::`);
	}
	if (leaf && leaf.syntax.kind === "leaf") lines.push(`::${leaf.syntax.directive}${braces(leaf)}`);
	if (mark && mark.syntax.kind === "text") lines.push(`문장 :${mark.syntax.directive}[라벨]${braces(mark)} 끝`);
	return lines;
};

const BODY = [
	"# 제목",
	"",
	"밑줄 :u[가], 위 :sup[2], 아래 :sub[i] 그리고 줄:br[]바꿈. 시각 12:30, \\:u[글자] 는 글자.",
	"",
	':::text-align{align="center"}',
	"가운데 문단",
	":::",
	"",
	'::image{mediaId="abc" alt="설명" width="60%"}',
	"",
	"![외부](https://example.com/a.png)",
	"",
	'::file{mediaId="def" label="자료"}',
	"",
	"::::table",
	":::row",
	"::cell[제목]{header colspan=2}",
	":::",
	":::row",
	"::cell[가]",
	"::cell[나]",
	":::",
	"::::",
	"",
	"| a | b |",
	"| - | - |",
	"| 1 | 2 |",
	"",
	...addedBlocks().flatMap((block) => [block, ""]),
	"마지막 :untranslated[원문]",
	"",
].join("\n");

describe("migrating directive content to standard MDX", () => {
	it("a body of directive syntax is written as standard MDX with the same content hash", () => {
		const written = write(BODY);
		expect(analyze(written).errors).toEqual([]);
		expect(DIRECTIVE_NOTATION.test(written)).toBe(false);
		expect(hashAfter(written)).toBe(hashBefore(BODY));
	});

	it("writing the migrated body again changes nothing", () => {
		expect(writeTwice(BODY)).toBe(write(BODY));
	});

	it("without the extension the same body is not read as directives", () => {
		expect(DIRECTIVE_NOTATION.test(BODY)).toBe(true);
		expect(hashAfter(BODY)).not.toBe(hashBefore(BODY));
	});
});
