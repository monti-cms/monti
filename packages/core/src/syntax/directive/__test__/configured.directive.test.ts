import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { analyze, serialize, toDocument } from "../../../mdx";
import { mdxRemarkPlugins, renderMdx } from "../../../render";

/**
 * Runs with the directive extension switched on in the site config (`mdx.syntax`, see `vitest.directive.config.ts`): the extension reaches
 * the parser, the serializer and the public render chain without any explicit list.
 */
const DIRECTIVES = ':::text-align{align="center"}\n가운데 :u[밑줄]\n:::\n\n::image{mediaId="abc" alt="설명"}\n';

describe("directive syntax configured in the site config", () => {
	it("is read by the parser", () => {
		const analysis = analyze(DIRECTIVES);
		expect(analysis.errors).toEqual([]);
		expect(toDocument(analysis).content?.map((node) => node.type)).toEqual(["TextAlign", "image"]);
	});

	it("is written by the serializer, except line breaks", () => {
		expect(serialize(toDocument(analyze(DIRECTIVES)))).toBe(DIRECTIVES);
		expect(serialize(toDocument(analyze("가:br[]나")))).toBe("가<br />\n나\n");
	});

	it("is read by the public render chain", async () => {
		const markup = renderToStaticMarkup((await renderMdx(DIRECTIVES)).content);
		expect(markup).toContain('class="cms-align-center"');
		expect(markup).toContain("<u>밑줄</u>");
	});

	it("puts the extension's plugins in the public remark chain", () => {
		expect(mdxRemarkPlugins().length).toBeGreaterThan(mdxRemarkPlugins([], []).length);
	});
});
