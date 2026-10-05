import { BLOCKS } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { mdxWith } from "../../test/mdx-syntax";
import { directiveSyntax } from "..";

/** Directive names of the current config's blocks. */
const DIRECTIVE_NAMES: ReadonlySet<string> = new Set(
	BLOCKS.flatMap((block) => ("directive" in block.syntax ? [block.syntax.directive] : [])),
);

/**
 * Storage round trip of a directive (block name) that is not in the config. Runs with both the reference blog setup and another site's config.
 * Another site's config has no tabs, so the `:::tab{…}` inside `::::tabs` used to gain backslashes on every save (`\{` → `\\\{`); this is the regression.
 * An unregistered block directive must be written as is, without escaping the source, so that reading and writing again gives the same result.
 */

/** A name that is not in the current config. If the config has no tabs, uses `tabs`/`tab`, which were actually hit; otherwise a name that is in no config. */
const unregistered = (preferred: string, fallback: string) => (DIRECTIVE_NAMES.has(preferred) ? fallback : preferred);
const outer = unregistered("tabs", "unregistered-outer");
const inner = unregistered("tab", "unregistered-inner");

/** Write path with the directive extension: `MDX → analyze → toDocument → serialize`. */
const { write } = mdxWith([directiveSyntax()]);

/** Bodies that must stay as the original source (top-level block). */
const verbatim: [string, string][] = [
	["묶음 안 미등록 컨테이너", `::::${outer}\n:::${inner}{label="a"}\n본문\n:::\n::::\n`],
	["마크다운 특수 글자가 든 컨테이너", `:::${outer}{title="x"}\na_b *c* \\ [d] \\{e} \`f\`\n:::\n`],
	["리프", `::${outer}{a="b" c}\n`],
	["앞뒤 문단 사이", `앞 문단\n\n::::${outer}\n:::${inner}{label="a"}\n본문\n:::\n::::\n\n뒤 문단\n`],
];

/** Cases nested inside another block. They may change once to the outer block's canonical shape, but must be the same after that. */
const nested: [string, string][] = [
	["인용 안", `> :::${outer}{label="a"}\n> a_b\n> :::\n`],
	["목록 안", `- :::${outer}{label="a"}\n  a_b\n  :::\n`],
];

describe("unregistered directive storage round trip", () => {
	it("the name this test uses is not in the current config", () => {
		for (const name of [outer, inner]) {
			expect(DIRECTIVE_NAMES.has(name)).toBe(false);
			expect(BLOCKS.some((block) => block.name === name)).toBe(false);
		}
	});

	it.each(verbatim)("%s is written as is", (_label, source) => {
		const first = write(source);
		expect(first).toBe(source);
		expect(write(first)).toBe(first);
	});

	it.each(nested)("%s is the same from the second save", (_label, source) => {
		const first = write(source);
		const second = write(first);
		expect(second).toBe(first);
		expect(write(second)).toBe(first);
		// The outer block's prefix (`> `, indentation) does not mix into the directive source and pile up.
		expect(first).not.toContain("> >");
		expect(first).toContain("a_b");
	});
});
