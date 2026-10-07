import { analyze, configuredSyntax, serialize, toDocument } from "@monti-cms/mdx/format";
import { renderMdx } from "@monti-cms/mdx/render";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testSite } from "../../test/site";

/**
 * Runs with the directive extension switched on in the site config (`plugins: [mdx({ syntax })]`, see `vitest.configured.config.ts`): the extension
 * reaches the parser, the serializer and the public render through the plugin options, without any explicit list in the call.
 */
const DIRECTIVES = ':::text-align{align="center"}\n가운데 :u[밑줄]\n:::\n\n::image{mediaId="abc" alt="설명"}\n';

const syntax = configuredSyntax(testSite);

describe("directive syntax configured in the site config", () => {
	it("is listed in the plugin options of the site config", () => {
		expect(syntax.length).toBeGreaterThan(0);
	});

	it("is read by the parser", () => {
		const analysis = analyze(testSite, DIRECTIVES, undefined, syntax);
		expect(analysis.errors).toEqual([]);
		expect(toDocument(testSite, analysis).content?.map((node) => node.type)).toEqual(["TextAlign", "image"]);
	});

	it("is written by the serializer, except line breaks", () => {
		expect(serialize(testSite, toDocument(testSite, analyze(testSite, DIRECTIVES, undefined, syntax)), syntax)).toBe(
			DIRECTIVES,
		);
		expect(serialize(testSite, toDocument(testSite, analyze(testSite, "가:br[]나", undefined, syntax)), syntax)).toBe(
			"가<br />\n나\n",
		);
	});

	it("is read by the public render, which defaults to the configured syntax", async () => {
		const markup = renderToStaticMarkup((await renderMdx(DIRECTIVES, { site: testSite })).content);
		expect(markup).toContain('class="cms-align-center"');
		expect(markup).toContain("<u>밑줄</u>");
	});
});
