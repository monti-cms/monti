import type { Site } from "@monti-cms/core/client";
import {
	assignBlockIds,
	emptyStoredDocument,
	readStoredDocument,
	type StoredDocument,
	unparsedDocument,
} from "@monti-cms/core/document";
import type { BrowserFormat } from "../../browser-format";
import type { RecoveryRecord } from "./entry-editor-client";
import { EMPTY_FORM, type EntryForm, formFingerprint } from "./entry-form";

/**
 * Recovery copies written before the form held the body as a document. They are in users' browsers (IndexedDB), so they are real stored data and must still
 * restore: such a copy has the body as MDX text in `snapshot.mdx` and no `snapshot.doc`.
 *
 * The admin knows no notation. When a browser format named like the copy's (`mdx`) is registered, the text is read through it, so the copy compares with the
 * server body like any current copy (one that equals it is dropped). Otherwise, or when the text does not read, it is kept as it is in an `unparsed` document
 * (format `mdx`), which a draft can hold: nothing the user typed is lost.
 */

/** The body of a legacy snapshot as a document, with block ids paired with the body of the entry it is a copy of. */
const documentOfLegacy = (
	mdx: string,
	server: StoredDocument | undefined,
	formats: Readonly<Record<string, BrowserFormat>> | undefined,
): StoredDocument => {
	// An empty text is the empty body (a copy of a new entry with nothing typed), not an unreadable one.
	if (mdx.trim() === "") return emptyStoredDocument();
	const read = formats?.mdx?.import(mdx);
	const doc = read?.ok ? read.doc : unparsedDocument(mdx, server, "mdx");
	return { ...doc, content: assignBlockIds(doc.content, [server?.content]) };
};

/**
 * The recovery copy in the form the editor works with. A copy that already holds a document has it checked and lifted to the current version; a copy with
 * `mdx` gets its `doc` from that text. `server` is the entry's current body, which the blocks of a restored text pair with. The fingerprint is worked out again,
 * so the copy compares with the form the way the editor makes it.
 */
export function upgradeRecoveryRecord(
	site: Site,
	record: RecoveryRecord,
	server?: StoredDocument,
	formats?: Readonly<Record<string, BrowserFormat>>,
): RecoveryRecord {
	const snapshot = record.snapshot as Record<string, unknown>;
	if (snapshot.doc !== undefined && typeof snapshot.mdx !== "string") {
		const next = {
			...record.snapshot,
			doc: readStoredDocument(snapshot.doc, site) ?? emptyStoredDocument(),
		} as EntryForm;
		return { ...record, snapshot: next, localFingerprint: formFingerprint(site, next) };
	}
	const { mdx, ...rest } = snapshot;
	const doc = typeof mdx === "string" ? documentOfLegacy(mdx, server, formats) : emptyStoredDocument();
	const next = { ...rest, doc } as EntryForm;
	return {
		...record,
		snapshot: next,
		localFingerprint: formFingerprint(site, next),
		// A copy of a new entry is compared with the empty form to see whether anything was typed: the empty form of the time the copy was written, when the title was the key `title`.
		baseFingerprint:
			record.entryId === "new" ? formFingerprint(site, { ...EMPTY_FORM, title: "" }) : record.baseFingerprint,
	};
}
