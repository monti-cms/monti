"use client";

import { type CSSProperties, useState } from "react";
import { computeImageTransform, intrinsicDisplayWidth } from "../../doc/image-transform";

/**
 * Body image (browser). Crop and rotate need the original aspect ratio, so they are fitted in the browser. The slot is reserved first with the original size the server knows.
 * If it cannot be read, an empty slot and `unavailableLabel` are shown.
 */
export function CmsImageView({
	src,
	alt,
	decorative,
	style,
	crop,
	rotate,
	title,
	intrinsicSize,
	unavailableLabel,
}: {
	src: string;
	alt: string;
	decorative?: boolean;
	style?: CSSProperties;
	crop?: string;
	rotate?: string | number;
	title?: string;
	intrinsicSize?: { width: number; height: number };
	unavailableLabel: string;
}) {
	const [failed, setFailed] = useState(false);
	const [natural, setNatural] = useState<{ width: number; height: number } | null>(intrinsicSize ?? null);
	const readNaturalSize = (image: HTMLImageElement) => {
		const { naturalWidth, naturalHeight } = image;
		if (naturalWidth <= 0 || naturalHeight <= 0) return;
		setNatural((current) =>
			current?.width === naturalWidth && current.height === naturalHeight
				? current
				: { width: naturalWidth, height: naturalHeight },
		);
	};
	const transform = computeImageTransform({
		crop,
		rotate,
		aspectRatio: natural ? natural.width / natural.height : null,
	});

	if (failed) {
		return (
			<div role="img" aria-label={decorative ? undefined : unavailableLabel} className="cms-image-unavailable">
				{decorative ? null : unavailableLabel}
			</div>
		);
	}
	if (transform.isTransformed) {
		const intrinsic = intrinsicDisplayWidth(transform, natural);
		return (
			<div
				className="cms-image-transform"
				style={{
					...style,
					width: style?.width ?? (intrinsic ? `${intrinsic}px` : "100%"),
					maxWidth: "100%",
					...transform.wrapperStyle,
				}}
			>
				{/* biome-ignore lint/performance/noImgElement: public addresses differ per site, so next/image is not used */}
				<img
					alt={decorative ? "" : alt}
					loading="lazy"
					onError={() => setFailed(true)}
					onLoad={(event) => readNaturalSize(event.currentTarget)}
					ref={(image) => {
						if (image?.complete) readNaturalSize(image);
					}}
					src={src}
					style={transform.imageStyle}
					title={title}
				/>
			</div>
		);
	}
	return (
		// biome-ignore lint/performance/noImgElement: public addresses differ per site, so next/image is not used
		<img
			alt={decorative ? "" : alt}
			className="cms-image-plain"
			height={intrinsicSize?.height}
			loading="lazy"
			onError={() => setFailed(true)}
			src={src}
			style={style}
			title={title}
			width={intrinsicSize?.width}
		/>
	);
}
