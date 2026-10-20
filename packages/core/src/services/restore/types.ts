import type { Cms } from "../../cms";
import type { CmsError } from "../../core/store/errors";
import type { RestorePlan, SkippedTemplate } from "../../core/store/types";

/** What a restore works with of a CMS instance. */
export type RestoreHost = Pick<Cms, "site" | "store" | "isMediaConfigured" | "mediaStore">;

/** What a problem is about. */
export type RestoreSubject = "archive" | "entry" | "folder" | "media" | "address" | "template";

export type RestoreProblemCode =
	| "files_unreadable"
	| "id_invalid"
	| "id_repeated"
	| "collection_unknown"
	| "locale_unknown"
	| "translation_repeated"
	| "source_missing"
	| "source_other_collection"
	| "translation_invalid"
	| "body_invalid"
	| "published_body_missing"
	| "publish_invalid"
	| "folder_missing"
	| "folder_other_collection"
	| "folder_cycle"
	| "media_missing"
	| "reference_missing"
	| "address_repeated"
	| "address_entry_missing"
	| "address_collection_unknown";

/** Something that stops the restore. Every problem is listed; any one of them refuses the restore. */
export interface RestoreProblem {
	readonly subject: RestoreSubject;
	/** The id of the entry, folder, media record or template; `null` for the archive as a whole. */
	readonly id: string | null;
	/** What a person recognises it by: an entry's title or slug, a folder's name, a media file's name. */
	readonly label: string | null;
	readonly code: RestoreProblemCode;
	readonly params?: Readonly<Record<string, string | number>>;
	/** The error a check threw (the content found wrong with a body, a rule a translation breaks). Only the route reads it, to write the text. */
	readonly error?: CmsError;
}

export type RestoreWarningCode = "media_file_missing" | "files_not_checked";

/** Something worth knowing that does not stop the restore. */
export interface RestoreWarning {
	readonly code: RestoreWarningCode;
	readonly id?: string;
	readonly label?: string;
	readonly params?: Readonly<Record<string, string | number>>;
}

export type NotRestoredCode = "preferences" | "accounts" | "api_keys" | "ai_connections" | "event_logs" | "plugins";

/** Data a backup does not carry, or a restore does not write. `count` is how many records of it the archive holds, when it holds some. */
export interface NotRestored {
	readonly code: NotRestoredCode;
	readonly count?: number;
}

/** What was read from an uploaded archive. */
export interface BackupRead {
	/** Whether the archive is a full admin backup: admin scope and no selection. */
	readonly isBackup: boolean;
	readonly plan: RestorePlan;
	/** What the archive holds of the data a restore does not bring back. */
	readonly notRestored: readonly NotRestored[];
	/** Problems found while reading (a file of an entry that could not be read). */
	readonly problems: readonly RestoreProblem[];
}

export interface RestoreCounts {
	entries: number;
	byStatus: Record<string, number>;
	translations: number;
	folders: number;
	media: number;
	addresses: number;
	/** Of the addresses: the former ones that keep redirecting. */
	aliases: number;
	templatesAdded: number;
	templatesSkipped: SkippedTemplate[];
}

/** What a restore would do, and whether it can. Nothing is written. */
export interface RestorePreview {
	readonly isBackup: boolean;
	/** Whether the site holds no entries, folders or media records. */
	readonly empty: boolean;
	readonly plan: RestorePlan;
	readonly counts: RestoreCounts;
	readonly problems: readonly RestoreProblem[];
	readonly warnings: readonly RestoreWarning[];
	readonly notRestored: readonly NotRestored[];
	/** Whether a run would go ahead: a full backup, an empty site and no problems. */
	readonly ready: boolean;
}
