import { adminApiUrl, type Site } from "@monti-cms/core/site";
import { adminFetch, apiErrorOf } from "./client";

export type ExportScope = "admin" | "public";

/** What an export is asked for: the scope, the entries (none: the whole site) and the text format to also write the bodies in (none: JSON documents only). */
export interface ExportRequest {
	scope: ExportScope;
	ids?: readonly string[];
	/** Limits the export to the entries of one collection (the trashed ones included). */
	collection?: string;
	format?: string;
}

/** What `GET /v1/export/summary` says an archive would hold. */
export interface ExportSummary {
	scope: ExportScope;
	entries: number;
	/** Entries that were not asked for but belong to the translation group of one that was. */
	addedByTranslations: number;
	/** Entries a public export leaves out because they are not published. */
	notPublished: number;
	/** Asked-for ids that match no entry. */
	notFound: number;
	templates: number;
	folders: number;
	addresses: number;
	/** Media records. The files stay in storage and are not part of the archive. */
	media: number;
}

/** A text format the server can write bodies in (the meta route's `formats`). */
export interface ExportFormat {
	name: string;
	label: string;
	extension: string;
}

/** Query keys. */
export const exportKeys = {
	all: ["cms", "export"] as const,
	formats: () => [...exportKeys.all, "formats"] as const,
	summary: (request: Pick<ExportRequest, "scope" | "ids" | "collection">) =>
		[...exportKeys.all, "summary", request.scope, request.ids?.join(",") ?? null, request.collection ?? null] as const,
};

/** The text formats installed on the server. */
export const listExportFormats = async (
	site: Site,
	signal?: AbortSignal,
	fallback?: string,
): Promise<ExportFormat[]> => {
	const meta = await adminFetch<{ formats?: ExportFormat[] }>(site, "/v1/meta", { signal, fallback });
	return (meta.formats ?? []).map(({ name, label, extension }) => ({ name, label, extension }));
};

/** What an export of `request` would hold. Nothing is built. (A `POST`, so a long list of ids fits.) */
export const getExportSummary = (
	site: Site,
	request: Pick<ExportRequest, "scope" | "ids" | "collection">,
	signal?: AbortSignal,
	fallback?: string,
) =>
	adminFetch<ExportSummary>(site, "/v1/export/summary", {
		method: "POST",
		json: {
			scope: request.scope,
			...(request.ids ? { ids: request.ids } : {}),
			...(request.collection ? { collection: request.collection } : {}),
		},
		signal,
		fallback,
	});

/** The archive of an export, read in full. */
export interface ExportDownload {
	blob: Blob;
	filename: string;
	/** How many bodies are in the archive as JSON only because the format could not write them. */
	notWritten: number;
}

/** How far a download is: `total` is `null` when the server did not say how large the archive is. */
export interface ExportProgress {
	received: number;
	total: number | null;
}

const filenameOf = (response: Response, fallback: string): string => {
	const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
	return match?.[1] ?? fallback;
};

const readBody = async (response: Response, onProgress?: (progress: ExportProgress) => void): Promise<Blob> => {
	const type = response.headers.get("Content-Type") ?? "application/zip";
	const length = Number(response.headers.get("Content-Length"));
	const total = Number.isFinite(length) && length > 0 ? length : null;
	if (!response.body) return response.blob();
	const reader = response.body.getReader();
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value as Uint8Array<ArrayBuffer>);
		received += value.byteLength;
		onProgress?.({ received, total });
	}
	return new Blob(chunks, { type });
};

/**
 * Builds the archive of `request` on the server and reads it, reporting how far the download is. A failure is thrown as
 * {@link CmsApiError}, in the admin language of `site`. (A `POST`, so a long list of ids fits.)
 */
export async function downloadExport(
	site: Site,
	request: ExportRequest,
	options: { signal?: AbortSignal; onProgress?: (progress: ExportProgress) => void; fallback?: string } = {},
): Promise<ExportDownload> {
	const fallback = options.fallback ?? "The export failed.";
	const response = await fetch(adminApiUrl("/v1/export"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			scope: request.scope,
			...(request.ids ? { ids: request.ids } : {}),
			...(request.collection ? { collection: request.collection } : {}),
			...(request.format ? { format: request.format } : {}),
		}),
		signal: options.signal,
	});
	if (!response.ok) {
		throw apiErrorOf(site, response.status, await response.json().catch(() => ({})), fallback);
	}
	const notWritten = Number(response.headers.get("X-Monti-Export-Not-Written") ?? 0);
	return {
		blob: await readBody(response, options.onProgress),
		filename: filenameOf(response, `monti-export-${request.scope}.zip`),
		notWritten: Number.isFinite(notWritten) ? notWritten : 0,
	};
}

/** Hands a file to the browser as a download. */
export function saveBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.style.display = "none";
	document.body.append(link);
	link.click();
	link.remove();
	// The browser starts the download when the click returns; the address is no longer needed after that.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
