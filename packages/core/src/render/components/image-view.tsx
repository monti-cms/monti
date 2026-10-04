"use client";

import { type CSSProperties, useState } from "react";
import { computeImageTransform, intrinsicDisplayWidth } from "../../mdx/image-transform";

/**
 * 본문 이미지(브라우저). 자르기·회전은 원본 비율을 알아야 해서 브라우저에서 맞춘다. 서버가 아는 원본 크기로 자리를 먼저 잡는다.
 * 읽지 못하면 빈 자리와 `unavailableLabel`을 보인다.
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
				{/* biome-ignore lint/performance/noImgElement: 공개 주소는 사이트마다 달라 next/image를 쓰지 않는다 */}
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
		// biome-ignore lint/performance/noImgElement: 공개 주소는 사이트마다 달라 next/image를 쓰지 않는다
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
