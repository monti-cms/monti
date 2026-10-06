import { ADDED_BLOCKS } from "@monti-cms/core/client";
import { readSamples, syntaxRemarkPlugins } from "@monti-cms/mdx/testing";
import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import { mdxWith } from "../../test/mdx-syntax";
import { directiveSyntax } from "..";

const directives = [directiveSyntax()];
const { parse: parseMdxAst } = mdxWith(directives);
/** A sample post body by file name (front matter removed). */
const readSample = (name: string): string => readSamples().find((sample) => sample.name === name)?.mdx ?? "";

const DIRECTIVE_TYPES = ["containerDirective", "leafDirective", "textDirective"];

/** A container block added by the site (looked up from the config, e.g. a callout) and its text attribute (the text to translate first). */
const siteContainer = ADDED_BLOCKS.find((block) => block.syntax.kind === "container" && !block.parent);
const siteAttribute = siteContainer
	? (Object.entries(siteContainer.attributes).find(([, attribute]) => attribute.translatable) ??
			Object.entries(siteContainer.attributes).find(([, attribute]) => attribute.type === "string"))?.[0]
	: undefined;

/**
 * A minimal reproduction chain with the extension's plugins, which are the ones the public chain uses (`syntaxRemarkPlugins`).
 * The full public chain (math, chart, mermaid, breaks, gfm, toc) is not here — render results are checked by the blocks package's
 * `directive-render.test.tsx`.
 */
const renderTree = (body: string): Root => {
	const processor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(syntaxRemarkPlugins(directives));

	const file = new VFile({ value: body });
	const tree = processor.parse(file);
	processor.runSync(tree, file);

	return tree as Root;
};

const collectDirectiveNames = (tree: Root): string[] => {
	const names: string[] = [];
	visit(tree, DIRECTIVE_TYPES, (node) => {
		names.push((node as { name?: string }).name ?? "");
	});
	return names;
};

const collectJsx = (
	tree: Root,
): {
	type: string;
	name: string | null;
	attributes: Record<string, string | null>;
	position?: { start?: { line?: number } };
}[] => {
	const found: {
		type: string;
		name: string | null;
		attributes: Record<string, string | null>;
		position?: { start?: { line?: number } };
	}[] = [];
	visit(tree, ["mdxJsxTextElement", "mdxJsxFlowElement"], (node) => {
		const element = node as {
			type: string;
			name?: string | null;
			attributes?: { name?: string; value?: unknown }[];
			position?: { start?: { line?: number } };
		};
		const attributes: Record<string, string | null> = {};
		for (const attribute of element.attributes ?? []) {
			if (!attribute.name) continue;
			attributes[attribute.name] = typeof attribute.value === "string" ? attribute.value : null;
		}
		found.push({ type: element.type, name: element.name ?? null, attributes, position: element.position });
	});
	return found;
};

const collectText = (tree: Root): string => {
	const parts: string[] = [];
	visit(tree, "text", (node) => {
		parts.push((node as { value: string }).value);
	});
	return parts.join("");
};

describe("directive syntax: turning unregistered directives back", () => {
	// 2 false positives measured on legacy posts. If not turned back, these characters silently disappear.
	it.each([
		["openai/gpt-oss-120b:free를 쓴다.", ":free를"],
		["비율이 1:1로 맞는다.", ":1로"],
	])("%s → %s is kept as body text", (body, expected) => {
		const tree = parseMdxAst(body);

		expect(collectDirectiveNames(tree)).toEqual([]);
		expect(collectText(tree)).toContain(expected);
	});

	it("an unregistered container is kept as the original source down to the inside", () => {
		const body = ":::unknown\n안쪽 :free를 그대로\n:::";
		const tree = parseMdxAst(body);

		expect(collectDirectiveNames(tree)).toEqual([]);
		expect(collectText(tree)).toBe(body);
	});
});

describe("directive syntax: registered directives", () => {
	it.skipIf(!siteContainer || !siteAttribute)(
		"the CMS analysis tree also turns registered names into MDX elements (reference collection and validation run on one shape)",
		() => {
			if (!siteContainer || !siteAttribute) return;
			const tree = parseMdxAst(`:::${siteContainer.name}{${siteAttribute}="제목"}\n본문\n:::`);

			// The stored string stays as is, and only the tree the analyzer sees takes the same shape as the public chain.
			expect(collectDirectiveNames(tree)).toEqual([]);
			expect(collectJsx(tree)).toEqual([
				expect.objectContaining({
					type: "mdxJsxFlowElement",
					name: siteContainer.component,
					attributes: { [siteAttribute]: "제목" },
				}),
			]);
		},
	);

	it("the analysis tree and the public render tree produce the same elements", () => {
		const body = [
			':::text-align{align="center"}',
			"가운데 문단",
			":::",
			"",
			"문장 안의 :u[밑줄] 과 줄바꿈:br[] 다음",
			"",
			'::image{mediaId="abc" width="60%"}',
		].join("\n");

		expect(collectJsx(parseMdxAst(body))).toEqual(collectJsx(renderTree(body)));
	});

	it("the public render turns registered names into MDX elements", () => {
		const tree = renderTree(
			[
				':::text-align{align="center"}',
				"가운데 문단",
				":::",
				"",
				"문장 안의 :u[밑줄] 과 :sup[위]·:sub[아래] 그리고 줄바꿈:br[] 다음",
				"",
				'::image{mediaId="abc" alt="설명" width="60%"}',
			].join("\n"),
		);

		// demote ran first, so no directive nodes remain.
		expect(collectDirectiveNames(tree)).toEqual([]);

		const jsx = collectJsx(tree);
		expect(jsx.map((element) => element.name)).toEqual(["TextAlign", "u", "sup", "sub", "br", "Image"]);
		expect(jsx[0]).toMatchObject({ type: "mdxJsxFlowElement", attributes: { align: "center" } });
		expect(jsx[5]).toMatchObject({ type: "mdxJsxFlowElement", attributes: { mediaId: "abc", width: "60%" } });
	});

	it("converted elements keep the directive's body position (warning and reference positions)", () => {
		const body = ["첫 문단", "", "둘째 줄 :u[밑줄] 끝", "", '::image{mediaId="abc"}'].join("\n");
		const jsx = collectJsx(parseMdxAst(body));

		// If the position is not copied, image warnings and media reference positions are always reported as 1:1.
		expect(jsx.find((element) => element.name === "Image")).toMatchObject({ position: { start: { line: 5 } } });
		expect(jsx.find((element) => element.name === "u")).toMatchObject({ position: { start: { line: 3 } } });
	});

	it("a false boolean creates no attribute (avoids the trap where 'false' is truthy)", () => {
		const [withFalse] = collectJsx(renderTree('::image{mediaId="abc" decorative="false"}'));
		const [withTrue] = collectJsx(renderTree('::image{mediaId="abc" decorative}'));
		const [withLiteralTrue] = collectJsx(renderTree('::image{mediaId="abc" decorative="true"}'));

		expect(withFalse.attributes).not.toHaveProperty("decorative");
		expect(withTrue.attributes).toMatchObject({ decorative: null });
		expect(withLiteralTrue.attributes).toMatchObject({ decorative: null });
	});
});

describe("invariants on real posts", () => {
	it("no unregistered name remains as a directive (0 cases)", () => {
		const offenders: string[] = [];
		for (const { name, mdx } of readSamples()) {
			const names = collectDirectiveNames(parseMdxAst(mdx));
			if (names.length > 0) offenders.push(`${name}: ${names.join(", ")}`);
		}

		expect(offenders).toEqual([]);
	});

	it("the 2 measured false positives remain in the body as they are", () => {
		expect(collectText(parseMdxAst(readSample("vector-rag-search.mdx")))).toContain(":free를");
		expect(collectText(parseMdxAst(readSample("tooltips-in-code-blocks.mdx")))).toContain(":1로");
	});
});
