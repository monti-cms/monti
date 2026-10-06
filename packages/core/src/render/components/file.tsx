import { fileTypeLabel, formatFileSize } from "../../core/file-display";
import type { ImageResolver } from "../../doc/image-src";

/**
 * Attachment file card (`::file{mediaId label}`). The address is decided by the resolver passed in (same as images). If it cannot be resolved, only the name shows and
 * there is no download.
 */
export function CmsFile({
	mediaId,
	label,
	resolve,
	downloadLabel = "Download",
	unavailableLabel = "File unavailable",
}: {
	mediaId?: string;
	label?: string;
	resolve?: ImageResolver;
	downloadLabel?: string;
	unavailableLabel?: string;
}) {
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
	return (
		<div className="cms-file">
			<div className="cms-file-text">
				<p className="cms-file-name">{name}</p>
				<p className="cms-file-details">{details}</p>
			</div>
			{ok ? (
				<a
					href={ok.url}
					download={filename || undefined}
					aria-label={`${name} ${downloadLabel}`}
					className="cms-file-download"
				>
					{downloadLabel}
				</a>
			) : null}
		</div>
	);
}
