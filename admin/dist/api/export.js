import { adminApiUrl } from "@monti-cms/core/site";
import { adminFetch, apiErrorOf } from "./client.js";
/** Query keys. */
export const exportKeys = {
    all: ["cms", "export"],
    formats: () => [...exportKeys.all, "formats"],
    summary: (request) => [...exportKeys.all, "summary", request.scope, request.ids?.join(",") ?? null],
};
/** The text formats installed on the server. */
export const listExportFormats = async (site, signal, fallback) => {
    const meta = await adminFetch(site, "/v1/meta", { signal, fallback });
    return (meta.formats ?? []).map(({ name, label, extension }) => ({ name, label, extension }));
};
/** What an export of `request` would hold. Nothing is built. (A `POST`, so a long list of ids fits.) */
export const getExportSummary = (site, request, signal, fallback) => adminFetch(site, "/v1/export/summary", {
    method: "POST",
    json: { scope: request.scope, ...(request.ids ? { ids: request.ids } : {}) },
    signal,
    fallback,
});
const filenameOf = (response, fallback) => {
    const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
    return match?.[1] ?? fallback;
};
const readBody = async (response, onProgress) => {
    const type = response.headers.get("Content-Type") ?? "application/zip";
    const length = Number(response.headers.get("Content-Length"));
    const total = Number.isFinite(length) && length > 0 ? length : null;
    if (!response.body)
        return response.blob();
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        chunks.push(value);
        received += value.byteLength;
        onProgress?.({ received, total });
    }
    return new Blob(chunks, { type });
};
/**
 * Builds the archive of `request` on the server and reads it, reporting how far the download is. A failure is thrown as
 * {@link CmsApiError}, in the admin language of `site`. (A `POST`, so a long list of ids fits.)
 */
export async function downloadExport(site, request, options = {}) {
    const fallback = options.fallback ?? "The export failed.";
    const response = await fetch(adminApiUrl("/v1/export"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            scope: request.scope,
            ...(request.ids ? { ids: request.ids } : {}),
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
export function saveBlob(blob, filename) {
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
