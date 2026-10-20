import type { Site } from "@monti-cms/core/site";
import { adminFetch } from "./client";

/** A reason the server gives for what it skipped, changed or could not do. The text is already in the admin language. */
export interface ImportReason {
	code: string;
	text: string;
	fix?: string;
}

/** Archive collection name → the collection it is imported into, or `null` to skip it. */
export type ImportMapping = Record<string, string | null>;

export interface ImportPreviewEntry {
	key: string;
	collection: string;
	target: string | null;
	title: string | null;
	slug: string | null;
	locale: string;
	isTranslation: boolean;
	/** Where the body is read from: a text in a format, or the stored JSON document. */
	body: { kind: "text"; format: string } | { kind: "json" } | null;
	published: boolean;
	outsideImages: number;
	keptLinks: number;
	skipped: ImportReason | null;
	notes: ImportReason[];
}

export interface ImportPreview {
	mode: "preview";
	kind: "export" | "markdown";
	collections: { name: string; entries: number; target: string | null; skipped: ImportReason | null }[];
	/** The document collections of this site an archive collection can go to. */
	targets: { name: string; label: string }[];
	entries: ImportPreviewEntry[];
	fieldsNotImported: { collection: string; target: string; fields: string[]; required: string[] }[];
	counts: {
		entries: number;
		imported: number;
		skipped: number;
		conflicts: number;
		publishable: number;
		outsideImages: number;
		keptLinks: number;
		otherFiles: number;
	};
}

export interface ImportStep {
	status: "done" | "skipped" | "failed";
	reason?: ImportReason;
}

export interface ImportResultEntry {
	key: string;
	collection: string;
	target: string | null;
	locale: string;
	title: string | null;
	slug: string | null;
	/** The new entry's id, once its draft exists. */
	id: string | null;
	outcome: "imported" | "draft" | "skipped" | "failed";
	create: ImportStep;
	body: ImportStep | null;
	publish: ImportStep | null;
	warnings: { code: string; text: string }[];
	notes: ImportReason[];
}

export interface ImportRun {
	mode: "run";
	results: ImportResultEntry[];
	counts: { imported: number; draft: number; skipped: number; failed: number; published: number };
}

export const importKeys = {
	all: ["cms", "import"] as const,
	limit: () => [...importKeys.all, "limit"] as const,
};

/** The largest zip the server takes, in bytes (the meta route's `limits.importBytes`). `undefined` when it does not say. */
export const getImportLimit = async (site: Site, signal?: AbortSignal): Promise<number | undefined> => {
	const meta = await adminFetch<{ limits?: { importBytes?: number } }>(site, "/v1/meta", { signal });
	return meta.limits?.importBytes;
};

const formOf = (file: File, mode: "preview" | "run", mapping: ImportMapping | undefined, publish: boolean) => {
	const form = new FormData();
	form.set("file", file);
	form.set("mode", mode);
	if (mapping) form.set("mapping", JSON.stringify(mapping));
	if (publish) form.set("publish", "true");
	return form;
};

/** What importing the file would do. Nothing is written. Without a `mapping`, a collection goes to the one of the same name. */
export const previewEntryImport = (site: Site, file: File, mapping?: ImportMapping, signal?: AbortSignal) =>
	adminFetch<ImportPreview>(site, "/v1/import/entries", {
		method: "POST",
		form: formOf(file, "preview", mapping, false),
		signal,
	});

/** Imports the file as new entries. The answer holds each entry's result; a single entry failing does not fail the request. */
export const runEntryImport = (site: Site, file: File, mapping: ImportMapping, publish: boolean) =>
	adminFetch<ImportRun>(site, "/v1/import/entries", { method: "POST", form: formOf(file, "run", mapping, publish) });
