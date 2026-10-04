import { type ImageResolver, resolveImageUrl } from "../../mdx/image-src";
import { CmsImageView } from "./image-view";

/** `width`는 1~100% 또는 1~4096px만 받는다. 그 밖의 값은 무시한다. */
const widthStyle = (value?: string) => {
	if (!value) return undefined;
	const percent = /^(\d{1,3}(?:\.\d+)?)%$/.exec(value);
	if (percent && Number(percent[1]) > 0 && Number(percent[1]) <= 100) return { width: value };
	const pixels = /^(\d+)px$/.exec(value);
	if (pixels && Number(pixels[1]) > 0 && Number(pixels[1]) <= 4096) return { width: value };
	return undefined;
};

const ALIGNS = new Set(["left", "center", "right"]);

/**
 * `::image{...}`. 주소는 부르는 쪽이 넘긴 해석기(`resolve`)가 정하고(없으면 바깥 `src`만), 이 컴포넌트는 DB를 읽지 않는다.
 * 해석하지 못하면 빈 자리와 캡션만 남기고 `width`·`align`은 쓰지 않는다. 실패 이유는 보이지 않고, `alt`로 바꿔 쓰지 않는다(§4.4).
 */
export function CmsImage({
	mediaId,
	src,
	alt,
	width,
	align,
	caption,
	decorative,
	crop,
	title,
	rotate,
	resolve,
	unavailableLabel = "Image unavailable",
}: {
	mediaId?: string;
	src?: string;
	alt?: string;
	width?: string;
	align?: string;
	caption?: string;
	decorative?: boolean;
	crop?: string;
	title?: string;
	rotate?: string | number;
	resolve?: ImageResolver;
	unavailableLabel?: string;
}) {
	const resolved = resolve ? resolve({ mediaId, src }) : resolveImageUrl(src);
	const ok = resolved && "url" in resolved ? resolved : null;
	const captionText = caption?.trim();
	const alignName = align && ALIGNS.has(align) ? align : "center";
	if (decorative && !ok) return captionText ? <p className="cms-image-caption">{captionText}</p> : null;
	if (!ok) {
		return (
			<figure className="cms-image cms-image-align-center">
				<div role="img" aria-label={unavailableLabel} className="cms-image-unavailable">
					{unavailableLabel}
				</div>
				{captionText ? <figcaption className="cms-image-caption">{captionText}</figcaption> : null}
			</figure>
		);
	}
	return (
		<figure className={`cms-image cms-image-align-${alignName}`}>
			<CmsImageView
				src={ok.url}
				alt={alt ?? ""}
				decorative={decorative}
				style={widthStyle(width)}
				crop={crop}
				rotate={rotate}
				title={title}
				intrinsicSize={ok.width && ok.height ? { width: ok.width, height: ok.height } : undefined}
				unavailableLabel={unavailableLabel}
			/>
			{captionText ? <figcaption className="cms-image-caption">{captionText}</figcaption> : null}
		</figure>
	);
}
