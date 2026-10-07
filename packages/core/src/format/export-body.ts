import type { Cms } from "../cms";
import type { Issue } from "../core/types";
import type { StoredDocument } from "../doc/stored-document";
import { createExportRefs } from "../read";
import { exportText } from "./convert";

/** What {@link exportBodyText} writes. */
export interface ExportBodyParams {
	/** The format to write, as `cms.formats()` knows it (for example `mdx`). */
	readonly format: string;
	readonly doc: StoredDocument;
	/** Language of the body. */
	readonly locale: string;
	/**
	 * Which entries internal links resolve to. `published` (the default): the published version of the target, and an unpublished target is not a link
	 * (a text that is imported again keeps its id). `working`: the target at its current address, drafts included.
	 */
	readonly scope?: "published" | "working";
}

/**
 * Writes a stored document as text in a format, the way the admin API and the admin export do (`purpose: "sync"`): the text is written to be imported again, links
 * are the real path of their target (an unresolved link keeps its id) and registered media stay by id. For a plugin that keeps bodies somewhere else (git-sync).
 * An unknown format fails with a `ServiceError` coded `unknown_format`.
 */
export async function exportBodyText(
	cms: Cms,
	params: ExportBodyParams,
): Promise<{ readonly text: string; readonly warnings: readonly Issue[] }> {
	const registry = await cms.formats();
	const refsOf = createExportRefs(
		{ site: cms.site, store: cms.store, mediaStore: cms.mediaStore },
		params.scope ?? "published",
	);
	return exportText(cms.site, registry, params.format, params.doc, {
		locale: params.locale,
		purpose: "sync",
		refs: await refsOf(params.doc, params.locale),
	});
}
