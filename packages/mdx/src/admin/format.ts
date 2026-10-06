import type { BrowserFormat } from "@monti-cms/admin";
import { DEFAULT_LOCALE } from "@monti-cms/core/client";
import type { FormatContext, FormatExportContext } from "@monti-cms/core/format";
import { createMdxFormat, type MdxFormatOptions } from "../format";
import { siteCodeLineEffects, siteSyntaxBlocks } from "../syntax-config";

/**
 * The `mdx` format as the browser uses it: its context (the site's blocks, the language) is bound, so a caller only gives documents and text. Both directions are
 * synchronous, as the format promises (`@monti-cms/core/format`), so the editor can ask for the text at once.
 */

const formatContext = (): FormatContext => ({
	locale: DEFAULT_LOCALE,
	blocks: siteSyntaxBlocks,
	codeLineEffects: siteCodeLineEffects,
});

/**
 * The context a text for an editor is written with: purpose `sync`, so the text can be read again as it is. An internal link keeps the id of its entry
 * (`entry:<id>`) and an image keeps its media id, unless the caller can give the address of the entry (`options.link`).
 */
const exportContext = (link?: (entryId: string) => string | null): FormatExportContext => ({
	...formatContext(),
	purpose: "sync",
	link: (entryId) => {
		const url = link?.(entryId);
		return url ? { url, title: null, locale: DEFAULT_LOCALE } : null;
	},
	media: () => null,
	report: () => {},
});

/** The browser side of the `mdx` format, reading and writing with the given syntax extensions. */
export const createMdxBrowserFormat = (options: MdxFormatOptions = {}): BrowserFormat => {
	const format = createMdxFormat(options);
	return {
		name: format.name,
		label: format.label,
		export(doc, exportOptions) {
			const text = format.export(doc, exportContext(exportOptions?.link));
			// The format is synchronous; one that is not cannot run where the editor needs the text at once.
			if (typeof text !== "string") throw new TypeError("The mdx format must write synchronously");
			return text;
		},
		import(text) {
			const read = format.import?.(text, formatContext());
			if (!read || "then" in read) throw new TypeError("The mdx format must read synchronously");
			return read.ok ? { ok: true, doc: read.doc, warnings: read.warnings ?? [] } : { ok: false, issues: read.issues };
		},
	};
};

/** The browser side of the `mdx` format with no syntax extension (standard MDX). The admin registers the one with the site's syntax. */
export const mdxBrowserFormat: BrowserFormat = createMdxBrowserFormat();
