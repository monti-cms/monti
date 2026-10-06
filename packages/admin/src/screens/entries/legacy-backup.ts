import {
	assignBlockIds,
	emptyStoredDocument,
	readStoredDocument,
	type StoredDocument,
	unparsedDocument,
} from "@monti-cms/core/document";
import { mdxBrowserFormat } from "../../mdx-source/format";
import type { RecoveryRecord } from "./entry-editor-client";
import { EMPTY_FORM, type EntryForm, formFingerprint } from "./entry-form";

/**
 * Recovery copies written before the form held the body as a document. They are in users' browsers (IndexedDB), so they are real stored data and must still
 * restore: such a copy has the body as MDX text in `snapshot.mdx` and no `snapshot.doc`.
 *
 * The text is read through the built-in `mdx` format, the one notation those copies were written in. A text that does not read is kept as it is, in an
 * `unparsed` document, which a draft can hold: nothing the user typed is lost.
 */

/** The body of a legacy snapshot as a document, with block ids paired with the body of the entry it is a copy of. */
const documentOfLegacy = (mdx: string, server: StoredDocument | undefined): StoredDocument => {
	const read = mdxBrowserFormat.import(mdx);
	const doc = read.ok ? read.doc : unparsedDocument(mdx, server, mdxBrowserFormat.name);
	return { ...doc, content: assignBlockIds(doc.content, [server?.content]) };
};

/**
 * The recovery copy in the form the editor works with. A copy that already holds a document has it checked and lifted to the current version; a copy with
 * `mdx` gets its `doc` from that text. `server` is the entry's current body, which the blocks of a restored text pair with. The fingerprint is worked out again,
 * so the copy compares with the form the way the editor makes it.
 */
export function upgradeRecoveryRecord(record: RecoveryRecord, server?: StoredDocument): RecoveryRecord {
	const snapshot = record.snapshot as Record<string, unknown>;
	if (snapshot.doc !== undefined && typeof snapshot.mdx !== "string") {
		const next = { ...record.snapshot, doc: readStoredDocument(snapshot.doc) ?? emptyStoredDocument() } as EntryForm;
		return { ...record, snapshot: next, localFingerprint: formFingerprint(next) };
	}
	const { mdx, ...rest } = snapshot;
	const doc = typeof mdx === "string" ? documentOfLegacy(mdx, server) : emptyStoredDocument();
	const next = { ...rest, doc } as EntryForm;
	return {
		...record,
		snapshot: next,
		localFingerprint: formFingerprint(next),
		// A copy of a new entry is compared with the empty form to see whether anything was typed.
		baseFingerprint: record.entryId === "new" ? formFingerprint(EMPTY_FORM) : record.baseFingerprint,
	};
}
