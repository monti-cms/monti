/**
 * Test helpers of the MDX package (`@monti-cms/mdx/testing`): the MDX pipeline with a given list of syntax extensions, the stored document of MDX text, the sample
 * posts, and a fixture renderer. Use only in package and site tests.
 */
import type { Site } from "@monti-cms/core/client";
import { analyze } from "./analyze.js";
import { bodyDocument, bodyFromMdx } from "./body.js";
import { parseMdxAst } from "./parse.js";
import { type RenderMdxOptions } from "./render.js";
import { serialize } from "./serialize.js";
import type { SyntaxExtension } from "./syntax/types.js";
import { toDocument } from "./to-document.js";
export { readSample, readSamples, SAMPLES_DIR } from "./__test__/fixtures/samples.js";
export { analyze, bodyDocument, bodyFromMdx, parseMdxAst, serialize, toDocument };
export { insertSoftBreaks, type SoftBreakResult } from "./soft-breaks.js";
export { syntaxRemarkPlugins } from "./syntax-config.js";
/**
 * The MDX pipeline (`analyze`, `toDocument`, `serialize`) of a site with a given list of syntax extensions. A site config that does not list an extension reads
 * standard MDX only, so tests of an extension's notation build the pipeline with it here. The pipeline functions are the production ones; only the extension list is passed in.
 */
export declare const mdxWith: (site: Site, syntax: readonly SyntaxExtension[]) => {
    analyze: (source: string, name?: string) => import("./types.js").CmsMdxAnalysis;
    parse: (body: string) => import("mdast").Root;
    toDocument: (analysis: Parameters<typeof toDocument>[1]) => import("@monti-cms/core/document").CmsNode;
    serialize: (doc: unknown) => string;
    /** `MDX → analyze → toDocument → serialize`. */
    write: (source: string) => string;
    /** Reading then writing the written string again must give the same string. */
    writeTwice: (source: string) => string;
};
/** The stored document of MDX text (an `unparsed` body when it cannot be read), as a write would store it. */
export declare const docOfMdx: (site: Site, mdx: string, syntax?: readonly SyntaxExtension[]) => import("@monti-cms/core/read").StoredDocument;
/** MDX text drawn the way the public page draws it (`renderMdx`): the markup, the table of contents and the React tree. */
export declare const renderFixture: (source: string, options: RenderMdxOptions) => Promise<{
    content: import("react").ReactNode;
    toc: readonly import("@monti-cms/core/render").DocumentTocItem[];
    unknown: readonly import("@monti-cms/core/render").StoredNode[];
    html: string;
}>;
