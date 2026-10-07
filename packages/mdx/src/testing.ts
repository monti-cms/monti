/**
 * Test helpers of the MDX package (`@monti-cms/mdx/testing`): the MDX pipeline with a given list of syntax extensions, the stored document of MDX text, the sample
 * posts, and a fixture renderer. Use only in package and site tests.
 */

import type { Site } from "@monti-cms/core/client";
import { renderToStaticMarkup } from "react-dom/server";
import { analyze } from "./analyze";
import { bodyDocument, bodyFromMdx } from "./body";
import { parseMdxAst } from "./parse";
import { type RenderMdxOptions, renderMdx } from "./render";
import { serialize } from "./serialize";
import type { SyntaxExtension } from "./syntax/types";
import { toDocument } from "./to-document";

export { readSample, readSamples, SAMPLES_DIR } from "./__test__/fixtures/samples";
export { analyze, bodyDocument, bodyFromMdx, parseMdxAst, serialize, toDocument };
export { insertSoftBreaks, type SoftBreakResult } from "./soft-breaks";
export { syntaxRemarkPlugins } from "./syntax-config";

/**
 * The MDX pipeline (`analyze`, `toDocument`, `serialize`) of a site with a given list of syntax extensions. A site config that does not list an extension reads
 * standard MDX only, so tests of an extension's notation build the pipeline with it here. The pipeline functions are the production ones; only the extension list is passed in.
 */
export const mdxWith = (site: Site, syntax: readonly SyntaxExtension[]) => {
	const read = (source: string, name?: string) => analyze(site, source, name, syntax);
	const write = (source: string): string => serialize(site, toDocument(site, read(source)), syntax);
	return {
		analyze: read,
		parse: (body: string) => parseMdxAst(site, body, syntax),
		toDocument: (analysis: Parameters<typeof toDocument>[1]) => toDocument(site, analysis),
		serialize: (doc: unknown) => serialize(site, doc, syntax),
		/** `MDX → analyze → toDocument → serialize`. */
		write,
		/** Reading then writing the written string again must give the same string. */
		writeTwice: (source: string): string => write(write(source)),
	};
};

/** The stored document of MDX text (an `unparsed` body when it cannot be read), as a write would store it. */
export const docOfMdx = (site: Site, mdx: string, syntax?: readonly SyntaxExtension[]) =>
	bodyDocument(bodyFromMdx(site, mdx, syntax));

/** MDX text drawn the way the public page draws it (`renderMdx`): the markup, the table of contents and the React tree. */
export const renderFixture = async (source: string, options: RenderMdxOptions) => {
	const rendered = await renderMdx(source, options);
	return { ...rendered, html: renderToStaticMarkup(rendered.content) };
};
