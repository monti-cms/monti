import { fileTypeLabel, formatFileSize } from "../../core/file-display";
import type { ImageResolver } from "../../mdx/image-src";

/**
 * 첨부 파일 카드(`::file{mediaId label}`). 주소는 넘긴 해석기가 정한다(이미지와 같다). 해석하지 못하면 이름만 보이고
 * 내려받기는 없다.
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
