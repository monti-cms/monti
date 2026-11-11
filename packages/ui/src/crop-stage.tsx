"use client";

import * as React from "react";

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
 */
function CropStage({
	src,
	alt,
	crop,
	stageRef,
	imageRef,
	onGrip,
	onGripKey,
	moveLabel,
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
	/** A key on the box or a corner: the same moves as the pointer, for a person with a keyboard. */
	onGripKey?: (event: React.KeyboardEvent, grip: CropGrip) => void;
	/** The name of the box, for screen readers. */
	moveLabel?: string;
	/** The names of the four corner handles, for screen readers. */
	cornerLabels: Record<CropCorner, string>;
}) {
	// The picture's shape, once it is in: the picture then fills the frame whatever its size, a small one drawn larger (2026-11-10, owner).
	const [shape, setShape] = React.useState<number | null>(null);
	return (
		<div
			data-slot="crop-stage"
			className="flex h-[min(62vh,560px)] w-full items-center justify-center overflow-hidden rounded-monti-md border bg-monti-tool p-monti-12 [container-type:size]"
		>
			<div
				ref={stageRef}
				onPointerDown={(event) => onGrip?.(event, "stage")}
				className="relative inline-block touch-none select-none"
				// design-allow: the picture's measured shape, fitted into the frame on both sides.
				style={shape ? { aspectRatio: shape, width: `min(100cqw, ${shape} * 100cqh)` } : undefined}
			>
				<img
					ref={imageRef}
					src={src}
					alt={alt}
					onLoad={(event) => {
						const { naturalWidth, naturalHeight } = event.currentTarget;
						if (naturalWidth && naturalHeight) setShape(naturalWidth / naturalHeight);
					}}
					className={`pointer-events-none block select-none rounded-monti-md ${shape ? "size-full" : "max-h-full max-w-full"}`}
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
