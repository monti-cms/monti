import type { Site } from "@monti-cms/core/site";
import { adminFetch } from "./client";

/** What stops a restore, with its text in the admin language. `found` is what the failed check of the content said, one line each. */
export interface RestoreProblem {
	subject: "archive" | "entry" | "folder" | "media" | "address" | "template";
	id: string | null;
	/** What a person recognises it by: an entry's title or address, a folder's name, a file name. */
	label: string | null;
	code: string;
	text: string;
	found: string[];
}

export interface RestoreWarning {
	code: string;
	id: string | null;
	label: string | null;
	text: string;
}

/** Data a restore does not bring back. */
export interface RestoreNotRestored {
	code: string;
	count: number | null;
	text: string;
}

export interface RestoreSkippedTemplate {
	id: string;
	name: string;
	reason: "id" | "name";
	text: string;
}

export interface RestoreCounts {
	entries: number;
	byStatus: Record<string, number>;
	translations: number;
	folders: number;
	media: number;
	addresses: number;
	aliases: number;
	templatesAdded: number;
	templatesSkipped: RestoreSkippedTemplate[];
}

export interface RestorePreview {
	mode: "preview";
	/** A run would go ahead: a full backup, an empty site, no problems. */
	ready: boolean;
	isBackup: boolean;
	/** Why the file is not a backup, when it is not. */
	refusal: { text: string; fix?: string } | null;
	empty: boolean;
	counts: RestoreCounts;
	problems: RestoreProblem[];
	warnings: RestoreWarning[];
	notRestored: RestoreNotRestored[];
}

export interface RestoreRun {
	mode: "run";
	counts: RestoreCounts;
	warnings: RestoreWarning[];
	notRestored: RestoreNotRestored[];
}

/** Whether the site holds no entries, folders or media records, and how many it holds. */
export interface RestoreState {
	empty: boolean;
	entries: number;
	folders: number;
	media: number;
}

export const restoreKeys = {
	all: ["cms", "restore"] as const,
	state: () => [...restoreKeys.all, "state"] as const,
	/** The preview of one chosen file. Outside the `cms` prefix, so refetching the admin's reads after a restore does not read the file again. */
	preview: (fileNumber: number) => ["restore-preview", fileNumber] as const,
};

const formOf = (file: File, mode: "preview" | "run") => {
	const form = new FormData();
	form.set("file", file);
	form.set("mode", mode);
	return form;
};

export const getRestoreState = (site: Site, signal?: AbortSignal) =>
	adminFetch<RestoreState>(site, "/v1/import/restore", { signal });

/** What restoring the file would do. Nothing is written. */
export const previewRestore = (site: Site, file: File, signal?: AbortSignal) =>
	adminFetch<RestorePreview>(site, "/v1/import/restore", { method: "POST", form: formOf(file, "preview"), signal });

/** Restores the file into the empty site, in one transaction. */
export const runRestore = (site: Site, file: File) =>
	adminFetch<RestoreRun>(site, "/v1/import/restore", { method: "POST", form: formOf(file, "run") });
