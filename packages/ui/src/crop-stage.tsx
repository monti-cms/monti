"use client";

import type * as React from "react";

/** A crop in % of the picture. */
export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** What is pressed: the stage (a new crop), the box (move it) or a corner (resize from it). */
export type CropGrip = "stage" | "move" | "nw" | "ne" | "sw" | "se";

const CORNERS = [
	{ grip: "nw", place: "-top-1.5 -left-1.5 cursor-nwse-resize" },
	{ grip: "ne", place: "-top-1.5 -right-1.5 cursor-nesw-resize" },
	{ grip: "sw", place: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
	{ grip: "se", place: "-right-1.5 -bottom-1.5 cursor-nwse-resize" },
] as const;

/**
 * The picture of the crop sheet in its frame: the tool ground with an edge and 4px inside, at most 380px high, the picture centered in it at most 360px
 * high. With a `crop`, the picture outside it lies under the backdrop and the crop is a 2px ink box with a square handle on each corner. Every press
 * reports what was pressed (`onGrip`); the stage is as large as the picture, so the screen measures the press against it (`stageRef`).
 */
function CropStage({
	src,
	alt,
	crop,
	stageRef,
	imageRef,
	onGrip,
	cornerLabels,
}: {
	src: string;
	alt: string;
	/** The crop, in % of the picture; absent when the whole picture is kept. */
	crop?: CropRect;
	/** The box the picture fills, for measuring where a press lands. */
	stageRef?: React.Ref<HTMLDivElement>;
	imageRef?: React.Ref<HTMLImageElement>;
	onGrip?: (event: React.PointerEvent, grip: CropGrip) => void;
	/** The names of the four corner handles, for screen readers. */
	cornerLabels: Record<"nw" | "ne" | "sw" | "se", string>;
}) {
	return (
		<div
			data-slot="crop-stage"
			className="flex max-h-[380px] w-full items-center justify-center overflow-hidden rounded-monti-md border bg-monti-tool p-monti-4"
		>
			<div
				ref={stageRef}
				onPointerDown={(event) => onGrip?.(event, "stage")}
				className="relative inline-block touch-none select-none"
			>
				<img
					ref={imageRef}
					src={src}
					alt={alt}
					className="pointer-events-none block max-h-[360px] max-w-full select-none rounded-monti-md"
					draggable={false}
				/>
				{crop && (
					<>
						<div
							className="pointer-events-none absolute inset-0 bg-monti-backdrop"
							style={{
								clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${crop.x}% ${crop.y}%, ${crop.x}% ${crop.y + crop.height}%, ${crop.x + crop.width}% ${crop.y + crop.height}%, ${crop.x + crop.width}% ${crop.y}%, ${crop.x}% ${crop.y}%)`,
							}}
						/>
						<div
							data-slot="crop-box"
							onPointerDown={(event) => {
								event.stopPropagation();
								onGrip?.(event, "move");
							}}
							className="absolute cursor-move border-2 border-monti-emphasis"
							style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}
						>
							{CORNERS.map(({ grip, place }) => (
								<button
									key={grip}
									type="button"
									data-slot={`crop-handle-${grip}`}
									aria-label={cornerLabels[grip]}
									onPointerDown={(event) => {
										event.stopPropagation();
										onGrip?.(event, grip);
									}}
									className={`absolute size-3.5 rounded-monti-sm border border-monti-default bg-monti-emphasis p-0 ${place}`}
								/>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

export { CropStage };
