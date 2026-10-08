import { unparsedDocument } from "@monti-cms/core/document";
import { analyze } from "./analyze.js";
import { bodyFromDocument, bodyFromMdx, toStoredDocument } from "./body.js";
import { createMdxFormat } from "./format.js";
import { insertSoftBreaks } from "./soft-breaks.js";
import { NO_SYNTAX } from "./syntax-config.js";
import { toDocument } from "./to-document.js";
/**
 * The server side of the MDX package (`@monti-cms/mdx/server`): the `mdx` format as the server registers it, with what the store migrations that predate
 * stored documents need of it.
 *
 * Old stores kept bodies as MDX text. Core still lists the migration steps for them (`0012_soft_line_endings`, `0013_stored_documents`,
 * `0015_code_annotations`) but does not parse MDX: those steps read and write the text through `legacyBodies` of this format, and ask for it only when a store
 * has a body to read. A fresh store, and a store already past those steps, never needs this module at migrate time.
 */
/** Reads and writes the MDX text of old bodies of `site`, with the given syntax extensions (the ones the site wrote them with). */
export const legacyBodies = (site, options = {}) => {
    const syntax = options.syntax ?? NO_SYNTAX;
    return {
        insertSoftBreaks: (text) => {
            const result = insertSoftBreaks(site, text, syntax);
            return result.status === "changed"
                ? { status: "changed", text: result.mdx }
                : result.status === "skipped"
                    ? {
                        status: "skipped",
                        reason: result.reason,
                        ...(result.detail === undefined ? {} : { detail: result.detail }),
                    }
                    : { status: "unchanged" };
        },
        read: (text, readOptions) => {
            const body = bodyFromMdx(site, text, syntax, readOptions);
            return { text: body.mdx, doc: body.doc };
        },
        write: (doc, writeOptions) => {
            const body = bodyFromDocument(site, doc, syntax, writeOptions);
            return { text: body.mdx, doc: body.doc };
        },
        documentOf: (text) => {
            const analysis = analyze(site, text, undefined, syntax);
            if (analysis.errors.length === 0) {
                try {
                    const stored = toStoredDocument(site, toDocument(site, analysis));
                    if (stored)
                        return stored;
                }
                catch {
                    // Not a document: kept as text below.
                }
            }
            return unparsedDocument(text);
        },
    };
};
/** The `mdx` format for the server: the format of `@monti-cms/mdx/format`, plus the old-body reader the store migrations ask for. */
export const createServerMdxFormat = (options = {}) => ({
    ...createMdxFormat(options),
    legacyBodies: (site) => legacyBodies(site, options),
});
