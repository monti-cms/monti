"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { useState } from "react";
import { cn } from "./cn";
import type { MontiIcon } from "./monti-icon";

/**
 * A picture in a frame of a fixed shape: `cover` fills the frame and crops, `contain` shows all of it. When the source is missing or fails,
 * the frame shows `fallback` (a file-type icon) on the neutral fill instead of a broken image; a failure is its address's, so a new address is tried
 * anew. While the picture is on its way the frame waits: it breathes (`animate-monti-wait`, `data-waiting`), and is still once the picture is in.
 */
const frameVariants = cva(
	"relative flex shrink-0 items-center justify-center overflow-hidden bg-monti-muted text-monti-muted",
	{
		variants: {
			ratio: {
				square: "aspect-square",
				photo: "aspect-[4/3]",
				wide: "aspect-video",
				share: "aspect-[1.91/1]",
				/** The cover in a narrow panel: three times as wide as tall. */
				banner: "aspect-[3/1]",
				auto: "",
			},
			size: {
				fill: "w-full",
				/** A file's picture before its name in a field: 20px, the line's own height of letters. */
				"thumb-sm": "size-monti-icon-lg",
				thumb: "size-monti-control-sm",
				"thumb-lg": "size-monti-control-lg",
				/** A file's picture in a list row: 40px wide at the ratio given (the tile's 4:3), so a row of files stays as tall as its title. */
				row: "w-monti-40",
				/** As big as an icon, no fill: a logo inside a button. */
				icon: "size-monti-icon-md bg-transparent",
			},
			radius: { none: "", sm: "rounded-monti-sm", md: "rounded-monti-md", lg: "rounded-monti-lg" },
			border: { true: "border border-monti-default" },
		},
		defaultVariants: { ratio: "square", size: "fill", radius: "md" },
	},
);

function Image({
	src,
	alt,
	fit = "cover",
	fallback: Fallback,
	ratio,
	size,
	radius,
	border,
	className,
	loading = "lazy",
	onLoad,
	frame,
	shape,
}: VariantProps<typeof frameVariants> & {
	src?: string | null;
	alt: string;
	fit?: "cover" | "contain";
	fallback?: MontiIcon;
	loading?: "lazy" | "eager";
	/** The picture has loaded (its natural size is on `event.currentTarget`). */
	onLoad?: React.ReactEventHandler<HTMLImageElement>;
	/**
	 * A cropped or turned picture (the core's `imageFrame`): the frame takes the crop's shape and the picture is placed in it, larger than the frame and in % of it.
	 * The site draws from the same sum.
	 */
	frame?: {
		aspectRatio: number;
		image: { left: number; top: number; width: number; height: number; rotate: number };
	} | null;
	/**
	 * The picture's own shape (width over height), when it is known before the picture is in: with `ratio="auto"` the frame stands at that shape from
	 * the start, so what is under it does not move when the picture comes in. A `frame` has its own shape.
	 */
	shape?: number | null;
	className?: string;
}) {
	// The address that did not answer with a picture: the next address is not that one (T136).
	const [failed, setFailed] = useState<string | null>(null);
	const show = src && failed !== src;
	// The address whose picture is in. Until it is, the frame is a place that waits (tokens.md, motion).
	const [arrived, setArrived] = useState<string | null>(null);
	const waiting = Boolean(show) && arrived !== src;
	const thumb = size === "thumb-sm" || size === "thumb" || size === "thumb-lg" || size === "icon";
	return (
		<span
			data-slot="image"
			data-waiting={waiting || undefined}
			className={cn(
				frameVariants({ ratio: thumb ? "square" : ratio, size, radius, border }),
				waiting && "animate-monti-wait",
				className,
			)}
			style={frame ? { aspectRatio: frame.aspectRatio } : shape ? { aspectRatio: shape } : undefined}
		>
			{show ? (
				<img
					src={src}
					alt={alt}
					loading={loading}
					// A picture the browser already has is in before any load event is heard.
					ref={(img) => {
						if (img?.complete && img.naturalWidth > 0) setArrived(src);
					}}
					onError={() => setFailed(src)}
					onLoad={(event) => {
						setArrived(src);
						onLoad?.(event);
					}}
					className={
						frame ? "absolute max-w-none" : cn("size-full", fit === "cover" ? "object-cover" : "object-contain")
					}
					style={
						frame
							? {
									left: `${frame.image.left}%`,
									top: `${frame.image.top}%`,
									width: `${frame.image.width}%`,
									height: `${frame.image.height}%`,
									transform: `translate(-50%, -50%) rotate(${frame.image.rotate}deg)`,
								}
							: undefined
					}
				/>
			) : (
				Fallback && <Fallback aria-hidden className={thumb ? "size-monti-icon-md" : "size-monti-icon-lg"} />
			)}
		</span>
	);
}

export { Image };
