"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "./cn";

/**
 * A picture in a frame of a fixed shape: `cover` fills the frame and crops, `contain` shows all of it. When the source is missing or fails,
 * the frame shows `fallback` (a file-type icon) on the neutral fill instead of a broken image.
 */
const frameVariants = cva(
	"relative flex shrink-0 items-center justify-center overflow-hidden bg-monti-neutral text-monti-muted",
	{
		variants: {
			ratio: {
				square: "aspect-square",
				photo: "aspect-[4/3]",
				wide: "aspect-video",
				share: "aspect-[1.91/1]",
				auto: "",
			},
			size: {
				fill: "w-full",
				thumb: "size-control-sm",
				"thumb-lg": "size-control-lg",
			/** As big as an icon, no fill: a logo inside a button. */
			icon: "size-icon bg-transparent",
			},
			radius: { none: "", sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg" },
			border: { true: "border border-monti-muted" },
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
}: VariantProps<typeof frameVariants> & {
	src?: string | null;
	alt: string;
	fit?: "cover" | "contain";
	fallback?: LucideIcon;
	loading?: "lazy" | "eager";
	className?: string;
}) {
	const [failed, setFailed] = useState(false);
	const show = src && !failed;
	const thumb = size === "thumb" || size === "thumb-lg" || size === "icon";
	return (
		<span
			data-slot="image"
			className={cn(frameVariants({ ratio: thumb ? "square" : ratio, size, radius, border }), className)}
		>
			{show ? (
				<img
					src={src}
					alt={alt}
					loading={loading}
					onError={() => setFailed(true)}
					className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain")}
				/>
			) : (
				Fallback && <Fallback aria-hidden className={thumb ? "size-icon" : "size-icon-lg"} />
			)}
		</span>
	);
}

export { Image };
