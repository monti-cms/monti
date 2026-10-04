import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { fileTypeLabel, formatFileSize } from "../../core/file-display.js";
/**
 * Attachment file card (`::file{mediaId label}`). The address is decided by the resolver passed in (same as images). If it cannot be resolved, only the name shows and
 * there is no download.
 */
export function CmsFile({ mediaId, label, resolve, downloadLabel = "Download", unavailableLabel = "File unavailable", }) {
    const resolved = mediaId && resolve ? resolve({ mediaId }) : null;
    const ok = resolved && "url" in resolved ? resolved : null;
    const filename = ok?.file?.filename ?? label ?? "";
    const name = label?.trim() || filename || unavailableLabel;
    const mimeType = ok?.file?.mimeType ?? null;
    const details = ok
        ? [fileTypeLabel(filename, mimeType), ok.file?.byteSize ? formatFileSize(ok.file.byteSize) : null]
            .filter(Boolean)
            .join(" · ")
        : unavailableLabel;
    return (_jsxs("div", { className: "cms-file", children: [_jsxs("div", { className: "cms-file-text", children: [_jsx("p", { className: "cms-file-name", children: name }), _jsx("p", { className: "cms-file-details", children: details })] }), ok ? (_jsx("a", { href: ok.url, download: filename || undefined, "aria-label": `${name} ${downloadLabel}`, className: "cms-file-download", children: downloadLabel })) : null] }));
}
