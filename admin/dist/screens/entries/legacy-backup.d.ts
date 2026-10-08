import type { Site } from "@monti-cms/core/client";
import { type StoredDocument } from "@monti-cms/core/document";
import type { BrowserFormat } from "../../browser-format.js";
import type { RecoveryRecord } from "./entry-editor-client.js";
/**
 * The recovery copy in the form the editor works with. A copy that already holds a document has it checked and lifted to the current version; a copy with
 * `mdx` gets its `doc` from that text. `server` is the entry's current body, which the blocks of a restored text pair with. The fingerprint is worked out again,
 * so the copy compares with the form the way the editor makes it.
 */
export declare function upgradeRecoveryRecord(site: Site, record: RecoveryRecord, server?: StoredDocument, formats?: Readonly<Record<string, BrowserFormat>>): RecoveryRecord;
