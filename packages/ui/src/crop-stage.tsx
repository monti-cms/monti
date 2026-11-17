"use client";

import * as React from "react";
import { cn } from "./cn";
import { Image } from "./image";

/** A crop in % of the picture. */
export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** What is pressed: the stage (a new crop), the box (move it) or a corner (resize from it). */
export type CropGrip = "stage" | "move" | CropCorner;
/** A corner of the crop, by the compass. */
export type CropCorner = "nw" | "ne" | "sw" | "se";

const CORNERS = [
	{ grip: "nw", place: "-top-1.5 -left-1.5 cursor-nwse-resize" },
	{ grip: "ne", place: "-top-1.5 -right-1.5 cursor-nesw-resize" },
	{ grip: "sw", place: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
	{ grip: "se", place: "-right-1.5 -bottom-1.5 cursor-nwse-resize" },
] as const;

/**
 * The picture of the crop dialog in its frame: the tool ground with an edge and 12px inside (a corner's handle and its focus ring stand outside the picture, and the frame clips), as high as 62% of the window (at most 560px), the picture
 * centered in it as large as it fits, a small one drawn larger (2026-11-10, owner: the picture is what the dialog is for). With a `crop`, the picture outside it lies under the backdrop and the crop
 * is a 2px ink box with a square handle on each corner and thirds drawn faintly inside. Every press reports what was pressed (`onGrip`); the stage is as
 * large as the picture, so the screen measures the press against it (`stageRef`).
 *
 * The picture stands in the frame that waits for a picture (`Image`): with the picture's `shape` known, the stage stands at it before the picture is in, the
 * crop box as large as the picture will be, and breathes until it comes (tokens.md, motion). Once the picture is in, its own shape is the stage's, whatever
 * was said of it. With no shape known and no picture yet there is nothing to crop: the box comes with the picture.
 */
function CropStage({
	src,
	alt,
	shape: told,
	crop,
	stageRef,
	onGrip,
	onGripKey,
	moveLabel,
	cornerLabels,
}: {
	/** The picture's address; `null` while there is none yet (a turned picture being made): the stage stands empty at `shape`. */
	src: string | null;
	alt: string;
	/** The picture's shape (width over height), when it is known before the picture is in. */
	shape?: number | null;
	/** The crop, in % of the picture; absent when the whole picture is kept. */
	crop?: CropRect;
	/** The box the picture fills, for measuring where a press lands. */
	stageRef?: React.Ref<HTMLDivElement>;
	onGrip?: (event: React.PointerEvent, grip: CropGrip) => void;
	/** A key on the box or a corner: the same moves as the pointer, for a person with a keyboard. */
	onGripKey?: (event: React.KeyboardEvent, grip: CropGrip) => void;
	/** The name of the box, for screen readers. */
	moveLabel?: string;
	/** The names of the four corner handles, for screen readers. */
	cornerLabels: Record<CropCorner, string>;
}) {
	// The shape of the picture that is in: the picture then fills the frame whatever its size, a small one drawn larger (2026-11-10, owner).
	const [measured, setMeasured] = React.useState<{ src: string; shape: number } | null>(null);
	// This address's own shape once it is in; until then the shape it was said to have, or the shape of the picture before it (a turn being made).
	const shape = (measured?.src === src ? measured.shape : null) ?? told ?? measured?.shape ?? null;
	return (
		<div
			data-slot="crop-stage"
			className="flex h-[min(62vh,560px)] w-full items-center justify-center overflow-hidden rounded-monti-md border bg-monti-tool p-monti-12 [container-type:size]"
		>
			<div
				ref={stageRef}
				onPointerDown={(event) => onGrip?.(event, "stage")}
				className={cn("relative touch-none select-none", shape ? "inline-block" : "size-full")}
				// design-allow: the picture's measured shape, fitted into the frame on both sides.
				style={shape ? { aspectRatio: shape, width: `min(100cqw, ${shape} * 100cqh)` } : undefined}
			>
				<Image
					src={src}
					alt={alt}
					ratio="auto"
					shape={shape}
					// All of the picture, should the shape said of it be off: a sliver of ground, not a cut picture.
					fit="contain"
					loading="eager"
					onLoad={(event) => {
						const { naturalWidth, naturalHeight } = event.currentTarget;
						if (src && naturalWidth && naturalHeight) setMeasured({ src, shape: naturalWidth / naturalHeight });
					}}
					// The stage takes the presses, and the picture is not dragged out of it.
					className="pointer-events-none size-full"
				/>
				{crop && shape && (
					<>
						<div
							className="pointer-events-none absolute inset-0 bg-monti-backdrop"
							style={{
								clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${crop.x}% ${crop.y}%, ${crop.x}% ${crop.y + crop.height}%, ${crop.x + crop.width}% ${crop.y + crop.height}%, ${crop.x + crop.width}% ${crop.y}%, ${crop.x}% ${crop.y}%)`,
							}}
						/>
						<div
							data-slot="crop-box"
							role="button"
							tabIndex={0}
							aria-label={moveLabel}
							onPointerDown={(event) => {
								event.stopPropagation();
								onGrip?.(event, "move");
							}}
							onKeyDown={(event) => {
								if (event.target === event.currentTarget) onGripKey?.(event, "move");
							}}
							className="absolute cursor-move border-2 border-monti-contrast outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast focus-visible:ring-offset-2"
							style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}
						>
							{/* Thirds, for placing what matters: faint, so the picture stays what is seen. */}
							<div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
								{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => (
									<span
										key={cell}
										className="border-monti-contrast/30 border-r border-b [&:nth-child(3n)]:border-r-0 [&:nth-child(n+7)]:border-b-0"
									/>
								))}
							</div>
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
									onKeyDown={(event) => onGripKey?.(event, grip)}
									className={`absolute size-3.5 rounded-monti-sm border border-monti-default bg-monti-emphasis p-0 outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast focus-visible:ring-offset-2 ${place}`}
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
