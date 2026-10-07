import { type CmsServerPlugin, type DoctorCheck, fail, ok } from "@monti-cms/core";
import type { Site } from "@monti-cms/core/client";
import { type StoredDocument, unparsedDocument } from "@monti-cms/core/document";
import type { CmsFormat, LegacyBodies } from "@monti-cms/core/format";
import { analyze } from "./analyze";
import { bodyFromDocument, bodyFromMdx, toStoredDocument } from "./body";
import { createMdxFormat, type MdxFormatOptions } from "./format";
import { insertSoftBreaks } from "./soft-breaks";
import { configuredSyntax, NO_SYNTAX, syntaxRemarkPlugins } from "./syntax-config";
import { toDocument } from "./to-document";

/**
 * The server side of the MDX package (`@monti-cms/mdx/server`): the `mdx` format as the server registers it, with what the store migrations that predate
 * stored documents need of it.
 *
 * Old stores kept bodies as MDX text. Core still lists the migration steps for them (`0012_soft_line_endings`, `0013_stored_documents`,
 * `0015_code_annotations`) but does not parse MDX: those steps read and write the text through `legacyBodies` of this format, and ask for it only when a store
 * has a body to read. A fresh store, and a store already past those steps, never needs this module at migrate time.
 */

/** Reads and writes the MDX text of old bodies of `site`, with the given syntax extensions (the ones the site wrote them with). */
export const legacyBodies = (site: Site, options: MdxFormatOptions = {}): LegacyBodies => {
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
		documentOf: (text): StoredDocument => {
			const analysis = analyze(site, text, undefined, syntax);
			if (analysis.errors.length === 0) {
				try {
					const stored = toStoredDocument(site, toDocument(site, analysis));
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
	legacyBodies: (site) => legacyBodies(site, options),
});

/** The checks the MDX plugin adds to `monti doctor`: the `mdx` format is registered, and the syntax extensions of `mdx({ syntax })` load. */
const mdxChecks: readonly DoctorCheck[] = [
	{
		id: "format",
		title: "mdx format",
		run: async ({ cms }) =>
			(await cms.formats()).get("mdx")
				? ok("the mdx format is registered (bodies can be read and written as MDX text)")
				: fail("the mdx format is not registered", {
						where: "`plugins` in monti.config.ts",
						fix: "list mdx() (from @monti-cms/mdx) in `plugins`, once",
					}),
	},
	{
		id: "syntax",
		title: "Syntax extensions",
		run: ({ cms }) => {
			const extensions = configuredSyntax(cms.site);
			if (extensions.length === 0) return ok("standard MDX only (no syntax extension listed)");
			try {
				// Builds every extension's remark plugins, then reads a small text with them (the analysis keeps a parser error in its list, so it is looked at).
				syntaxRemarkPlugins(cms.site, extensions);
				const [first] = analyze(cms.site, "Hello **world**", undefined, extensions).errors;
				if (first) throw new Error(first.message);
			} catch (error) {
				return fail(`a syntax extension failed to load: ${error instanceof Error ? error.message : String(error)}`, {
					where: "`syntax` of mdx() in monti.config.ts",
					fix: "check the extension's options against its package README, or remove it from the list; if it names a package, install it with your package manager",
				});
			}
			return ok(`${extensions.map((extension) => extension.name).join(", ")} load`);
		},
	},
];

/** Server side of the MDX plugin (`plugin.server`): its `monti doctor` checks. The format itself is loaded through `plugin.formats`. */
const mdxServer: CmsServerPlugin = { checks: mdxChecks };

export default mdxServer;
