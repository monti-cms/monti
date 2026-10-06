import type { StoredDocument } from "@monti-cms/core/document";
import type { FormatIssue } from "@monti-cms/core/format";

/**
 * A format as the browser uses it: its context (the site's blocks, the language) is bound, so a caller only gives documents and text. Both directions are
 * pure and synchronous, which is what a format promises (`@monti-cms/core/format`). A plugin registers one with `CmsAdminComponents.formats`; code that needs a
 * notation (the source panel, AI) asks for it by name with `useFormat`.
 */
export interface BrowserFormat {
	readonly name: string;
	readonly label: string;
	/**
	 * Document → text, written to be read again: an internal link keeps the id of its entry and an image keeps its media id, so `import` returns what was given.
	 * A node the format does not know is kept as the format can.
	 */
	export(doc: StoredDocument): string;
	/**
	 * Text → document. Block ids are not given (they are core's: pair the blocks with the body the text replaces with `assignBlockIds`). A text the format
	 * cannot read is `ok: false` with its findings.
	 */
	import(text: string): BrowserImportResult;
}

export type BrowserImportResult =
	| { readonly ok: true; readonly doc: StoredDocument; readonly warnings: readonly FormatIssue[] }
	| { readonly ok: false; readonly issues: readonly FormatIssue[] };
