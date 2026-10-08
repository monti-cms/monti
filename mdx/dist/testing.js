/**
 * Test helpers of the MDX package (`@monti-cms/mdx/testing`): the MDX pipeline with a given list of syntax extensions, the stored document of MDX text, the sample
 * posts, and a fixture renderer. Use only in package and site tests.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { analyze } from "./analyze.js";
import { bodyDocument, bodyFromMdx } from "./body.js";
import { parseMdxAst } from "./parse.js";
import { renderMdx } from "./render.js";
import { serialize } from "./serialize.js";
import { toDocument } from "./to-document.js";
export { readSample, readSamples, SAMPLES_DIR } from "./__test__/fixtures/samples.js";
export { analyze, bodyDocument, bodyFromMdx, parseMdxAst, serialize, toDocument };
export { insertSoftBreaks } from "./soft-breaks.js";
export { syntaxRemarkPlugins } from "./syntax-config.js";
/**
 * The MDX pipeline (`analyze`, `toDocument`, `serialize`) of a site with a given list of syntax extensions. A site config that does not list an extension reads
 * standard MDX only, so tests of an extension's notation build the pipeline with it here. The pipeline functions are the production ones; only the extension list is passed in.
 */
export const mdxWith = (site, syntax) => {
    const read = (source, name) => analyze(site, source, name, syntax);
    const write = (source) => serialize(site, toDocument(site, read(source)), syntax);
    return {
        analyze: read,
        parse: (body) => parseMdxAst(site, body, syntax),
        toDocument: (analysis) => toDocument(site, analysis),
        serialize: (doc) => serialize(site, doc, syntax),
        /** `MDX → analyze → toDocument → serialize`. */
        write,
        /** Reading then writing the written string again must give the same string. */
        writeTwice: (source) => write(write(source)),
    };
};
/** The stored document of MDX text (an `unparsed` body when it cannot be read), as a write would store it. */
export const docOfMdx = (site, mdx, syntax) => bodyDocument(bodyFromMdx(site, mdx, syntax));
/** MDX text drawn the way the public page draws it (`renderMdx`): the markup, the table of contents and the React tree. */
export const renderFixture = async (source, options) => {
    const rendered = await renderMdx(source, options);
    return { ...rendered, html: renderToStaticMarkup(rendered.content) };
};
