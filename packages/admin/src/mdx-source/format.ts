import { DEFAULT_LOCALE } from "@monti-cms/core/client";
import type { FormatExportContext } from "@monti-cms/core/format";
import { builtInFormatContext, mdxFormat } from "@monti-cms/core/format/mdx";
import type { BrowserFormat } from "../browser-format";

/**
 * The built-in `mdx` format as the browser uses it. This module (`mdx-source/`) is everything in the admin that knows MDX: the source panel, its toggle model
 * and this format. It is the one place that moves out when MDX leaves core (`@monti-cms/mdx/admin`); the rest of the admin only sees `sourcePanels` and `formats`.
 */

/**
 * The context a text for an editor is written with: purpose `sync`, so the text can be read again as it is. An internal link keeps the id of its entry
 * (`entry:<id>`) and an image keeps its media id, unless the caller can give the address of the entry (`options.link`).
 */
const exportContext = (link?: (entryId: string) => string | null): FormatExportContext => ({
	...builtInFormatContext(DEFAULT_LOCALE),
	purpose: "sync",
	link: (entryId) => {
		const url = link?.(entryId);
		return url ? { url, title: null, locale: DEFAULT_LOCALE } : null;
	},
	media: () => null,
	report: () => {},
});

export const mdxBrowserFormat: BrowserFormat = {
	name: mdxFormat.name,
	label: mdxFormat.label,
	export(doc, options) {
		const text = mdxFormat.export(doc, exportContext(options?.link));
		// The built-in format is synchronous; a format that is not cannot run where the editor needs the text at once.
		if (typeof text !== "string") throw new TypeError("The mdx format must write synchronously");
		return text;
	},
	import(text) {
		const read = mdxFormat.import?.(text, builtInFormatContext(DEFAULT_LOCALE));
		if (!read || "then" in read) throw new TypeError("The mdx format must read synchronously");
		return read.ok ? { ok: true, doc: read.doc, warnings: read.warnings ?? [] } : { ok: false, issues: read.issues };
	},
};
