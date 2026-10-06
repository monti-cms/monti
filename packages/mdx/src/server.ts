import { type StoredDocument, unparsedDocument } from "@monti-cms/core/document";
import type { CmsFormat, LegacyBodies } from "@monti-cms/core/format";
import { analyze } from "./analyze";
import { bodyFromDocument, bodyFromMdx, toStoredDocument } from "./body";
import { createMdxFormat, type MdxFormatOptions } from "./format";
import { insertSoftBreaks } from "./soft-breaks";
import { NO_SYNTAX } from "./syntax-config";
import { toDocument } from "./to-document";

/**
 * The server side of the MDX package (`@monti-cms/mdx/server`): the `mdx` format as the server registers it, with what the store migrations that predate
 * stored documents need of it.
 *
 * Old stores kept bodies as MDX text. Core still lists the migration steps for them (`0012_soft_line_endings`, `0013_stored_documents`,
 * `0015_code_annotations`) but does not parse MDX: those steps read and write the text through `legacyBodies` of this format, and ask for it only when a store
 * has a body to read. A fresh store, and a store already past those steps, never needs this module at migrate time.
 */

/** Reads and writes the MDX text of old bodies with the given syntax extensions (the ones the site wrote them with). */
export const legacyBodies = (options: MdxFormatOptions = {}): LegacyBodies => {
	const syntax = options.syntax ?? NO_SYNTAX;
	return {
		insertSoftBreaks: (text) => {
			const result = insertSoftBreaks(text, syntax);
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
			const body = bodyFromMdx(text, syntax, readOptions);
			return { text: body.mdx, doc: body.doc };
		},
		write: (doc, writeOptions) => {
			const body = bodyFromDocument(doc, syntax, writeOptions);
			return { text: body.mdx, doc: body.doc };
		},
		documentOf: (text): StoredDocument => {
			const analysis = analyze(text, undefined, syntax);
			if (analysis.errors.length === 0) {
				try {
					const stored = toStoredDocument(toDocument(analysis));
					if (stored) return stored;
				} catch {
					// Not a document: kept as text below.
				}
			}
			return unparsedDocument(text);
		},
	};
};

/** The `mdx` format for the server: the format of `@monti-cms/mdx/format`, plus the old-body reader the store migrations ask for. */
export const createServerMdxFormat = (options: MdxFormatOptions = {}): CmsFormat<"mdx"> => ({
	...createMdxFormat(options),
	legacyBodies: legacyBodies(options),
});
