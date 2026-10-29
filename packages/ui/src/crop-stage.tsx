"use client";

import type * as React from "react";
import { cn } from "./cn";

/**
 * The picture of the crop sheet in its frame: the tool ground with an edge and 4px inside, at most 380px high, the picture centered in it at most 360px
 * high. The stage is as large as the picture, so what is laid over it (the mask and the crop box, as `children`) is placed in % of the picture.
 * Pointer presses on the stage go to `onPointerDown`; touch does not scroll it.
 */
function CropStage({
	src,
	alt,
	stageRef,
	imageRef,
	onPointerDown,
	children,
}: {
	src: string;
	alt: string;
	/** The box the picture fills, for measuring where a press lands. */
	stageRef?: React.Ref<HTMLDivElement>;
	imageRef?: React.Ref<HTMLImageElement>;
	onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
	children?: React.ReactNode;
}) {
	return (
		<div
			data-slot="crop-stage"
			className="flex max-h-[380px] w-full items-center justify-center overflow-hidden rounded-monti-md border bg-monti-tool p-monti-4"
		>
			<div ref={stageRef} onPointerDown={onPointerDown} className={cn("relative inline-block touch-none select-none")}>
				<img
					ref={imageRef}
					src={src}
					alt={alt}
					className="pointer-events-none block max-h-[360px] max-w-full select-none rounded-monti-md"
					draggable={false}
				/>
				{children}
			</div>
		</div>
	);
}

export { CropStage };
