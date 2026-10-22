"use client";

// design-system: drawing — the crop area is the image with a rectangle, mask and handles positioned by percent and pointer drag

import {
	type CropBox,
	formatCrop,
	isFullCrop,
	parseCrop,
	parseRotate,
	type RotateDegree,
	roundCropBox,
} from "@monti-cms/core/document";
import { useTranslator } from "@monti-cms/core/site";
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Grid,
	Inline,
	Input,
	Label,
	Stack,
	Text,
} from "@monti-cms/ui";
import { RotateCw } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { commonMessages } from "../lib/common.messages";
import { editorMessages } from "./messages";

export interface ImageCropDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	src: string;
	crop?: string | null;
	rotate?: string | number | null;
	onApply: (result: { crop: string | null; rotate: string | null }) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export function ImageCropDialog({ open, onOpenChange, src, crop, rotate, onApply }: ImageCropDialogProps) {
	const t = useTranslator(editorMessages);
	const tc = useTranslator(commonMessages);
	const containerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const activeDragCleanupRef = useRef<(() => void) | null>(null);

	const [cropDraft, setCropDraft] = useState<CropBox>({ x: 0, y: 0, width: 100, height: 100 });
	const [rotateDraft, setRotateDraft] = useState<number>(0);

	useEffect(() => {
		return () => {
			activeDragCleanupRef.current?.();
		};
	}, []);

	useEffect(() => {
		// Do not leave global pointer listeners behind if the dialog closes mid-drag.
		if (!open) {
			activeDragCleanupRef.current?.();
			return;
		}
		const parsedCrop = parseCrop(crop);
		setCropDraft(parsedCrop || { x: 0, y: 0, width: 100, height: 100 });
		const parsedRot = parseRotate(rotate);
		setRotateDraft(parsedRot || 0);
	}, [open, crop, rotate]);

	const handleRotate90 = () => {
		setRotateDraft((prev) => ((prev + 90) % 360) as 0 | RotateDegree);
	};

	const handleResetRotate = () => {
		setRotateDraft(0);
	};

	const handleResetCrop = () => {
		setCropDraft({ x: 0, y: 0, width: 100, height: 100 });
	};

	const handleResetAll = () => {
		handleResetCrop();
		handleResetRotate();
	};

	const handleApply = (event?: React.FormEvent<HTMLElement>) => {
		event?.preventDefault();
		const finalCrop = isFullCrop(cropDraft) ? null : formatCrop(cropDraft);
		const finalRotate = rotateDraft === 0 ? null : String(rotateDraft);
		onApply({ crop: finalCrop, rotate: finalRotate });
		onOpenChange(false);
	};

	// Alternative: typing values directly with the keyboard
	const handleNumericCropChange = (field: keyof CropBox, rawValue: number) => {
		if (!Number.isFinite(rawValue)) return;
		const val = round2(rawValue);
		setCropDraft((prev) => {
			let { x, y, width, height } = prev;
			if (field === "x") {
				x = clamp(val, 0, 99);
				if (x + width > 100) width = round2(100 - x);
			} else if (field === "y") {
				y = clamp(val, 0, 99);
				if (y + height > 100) height = round2(100 - y);
			} else if (field === "width") {
				width = clamp(val, 1, round2(100 - x));
			} else if (field === "height") {
				height = clamp(val, 1, round2(100 - y));
			}
			return { x, y, width, height };
		});
	};

	// Select the crop area by dragging (free aspect ratio, coordinates relative to the real image element)
	const handlePointerDown = (e: React.PointerEvent, handle?: "move" | "nw" | "ne" | "sw" | "se") => {
		e.preventDefault();
		e.stopPropagation();

		const targetElement = imgRef.current ?? containerRef.current;
		if (!targetElement) return;

		const rect = targetElement.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;

		activeDragCleanupRef.current?.();

		const startClientX = e.clientX;
		const startClientY = e.clientY;
		const startXPercent = clamp(((startClientX - rect.left) / rect.width) * 100, 0, 100);
		const startYPercent = clamp(((startClientY - rect.top) / rect.height) * 100, 0, 100);
		const initialCrop = { ...cropDraft };

		const onPointerMove = (moveEvent: PointerEvent) => {
			const currentXPercent = clamp(((moveEvent.clientX - rect.left) / rect.width) * 100, 0, 100);
			const currentYPercent = clamp(((moveEvent.clientY - rect.top) / rect.height) * 100, 0, 100);
			const deltaX = currentXPercent - startXPercent;
			const deltaY = currentYPercent - startYPercent;

			if (!handle) {
				// Clicking outside the area starts a new rectangle by dragging
				const x = Math.min(startXPercent, currentXPercent);
				const y = Math.min(startYPercent, currentYPercent);
				const width = Math.abs(currentXPercent - startXPercent);
				const height = Math.abs(currentYPercent - startYPercent);
				if (width >= 2 && height >= 2) {
					setCropDraft(roundCropBox({ x, y, width, height }));
				}
				return;
			}

			if (handle === "move") {
				const newX = clamp(initialCrop.x + deltaX, 0, 100 - initialCrop.width);
				const newY = clamp(initialCrop.y + deltaY, 0, 100 - initialCrop.height);
				setCropDraft(roundCropBox({ ...initialCrop, x: newX, y: newY }));
				return;
			}

			if (handle === "se") {
				const newWidth = clamp(initialCrop.width + deltaX, 2, 100 - initialCrop.x);
				const newHeight = clamp(initialCrop.height + deltaY, 2, 100 - initialCrop.y);
				setCropDraft(roundCropBox({ ...initialCrop, width: newWidth, height: newHeight }));
			} else if (handle === "sw") {
				const maxLeft = initialCrop.x + initialCrop.width - 2;
				const newX = clamp(initialCrop.x + deltaX, 0, maxLeft);
				const newWidth = initialCrop.x + initialCrop.width - newX;
				const newHeight = clamp(initialCrop.height + deltaY, 2, 100 - initialCrop.y);
				setCropDraft(roundCropBox({ x: newX, y: initialCrop.y, width: newWidth, height: newHeight }));
			} else if (handle === "ne") {
				const newWidth = clamp(initialCrop.width + deltaX, 2, 100 - initialCrop.x);
				const maxTop = initialCrop.y + initialCrop.height - 2;
				const newY = clamp(initialCrop.y + deltaY, 0, maxTop);
				const newHeight = initialCrop.y + initialCrop.height - newY;
				setCropDraft(roundCropBox({ x: initialCrop.x, y: newY, width: newWidth, height: newHeight }));
			} else if (handle === "nw") {
				const maxLeft = initialCrop.x + initialCrop.width - 2;
				const maxTop = initialCrop.y + initialCrop.height - 2;
				const newX = clamp(initialCrop.x + deltaX, 0, maxLeft);
				const newY = clamp(initialCrop.y + deltaY, 0, maxTop);
				const newWidth = initialCrop.x + initialCrop.width - newX;
				const newHeight = initialCrop.y + initialCrop.height - newY;
				setCropDraft(roundCropBox({ x: newX, y: newY, width: newWidth, height: newHeight }));
			}
		};

		const cleanup = () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			activeDragCleanupRef.current = null;
		};

		const onPointerUp = () => {
			cleanup();
		};

		const onPointerCancel = () => {
			cleanup();
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		activeDragCleanupRef.current = cleanup;
	};

	const isFull = isFullCrop(cropDraft);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="lg">
				<Stack as="form" gap="comfortable" onSubmit={handleApply}>
					<DialogHeader>
						<DialogTitle>{t("imageCrop.title")}</DialogTitle>
					</DialogHeader>

					{/* Image area + crop overlay (wrapper sized to the real image) */}
					<Stack gap="condensed" align="center">
						<div className="flex max-h-[380px] w-full items-center justify-center overflow-hidden rounded-md border bg-monti-inset p-tight">
							<div
								ref={containerRef}
								onPointerDown={(e) => handlePointerDown(e)}
								className="relative inline-block select-none"
								style={{ touchAction: "none" }}
							>
								<img
									ref={imgRef}
									src={src}
									alt={t("imageCrop.target")}
									className="pointer-events-none block max-h-[360px] max-w-full select-none rounded-md"
									draggable={false}
								/>

								{/* Selected crop area */}
								{!isFull && (
									<>
										{/* Dark translucent background mask (outside the area, design tokens applied) */}
										<div
											className="pointer-events-none absolute inset-0 bg-monti-emphasis"
											style={{
												clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${cropDraft.x}% ${cropDraft.y}%, ${cropDraft.x}% ${cropDraft.y + cropDraft.height}%, ${cropDraft.x + cropDraft.width}% ${cropDraft.y + cropDraft.height}%, ${cropDraft.x + cropDraft.width}% ${cropDraft.y}%, ${cropDraft.x}% ${cropDraft.y}%)`,
											}}
										/>

										{/* Active crop rectangle */}
										<div
											data-slot="crop-box"
											onPointerDown={(e) => handlePointerDown(e, "move")}
											className="absolute cursor-move border-2 border-monti-emphasis"
											style={{
												left: `${cropDraft.x}%`,
												top: `${cropDraft.y}%`,
												width: `${cropDraft.width}%`,
												height: `${cropDraft.height}%`,
											}}
										>
											{/* 4 corner handles */}
											<button
												type="button"
												data-slot="crop-handle-nw"
												onPointerDown={(e) => handlePointerDown(e, "nw")}
												className="absolute -top-1.5 -left-1.5 size-3.5 cursor-nwse-resize rounded-sm border border-monti-default bg-monti-emphasis p-0"
												aria-label={t("imageCrop.handleNw")}
											/>
											<button
												type="button"
												data-slot="crop-handle-ne"
												onPointerDown={(e) => handlePointerDown(e, "ne")}
												className="absolute -top-1.5 -right-1.5 size-3.5 cursor-nesw-resize rounded-sm border border-monti-default bg-monti-emphasis p-0"
												aria-label={t("imageCrop.handleNe")}
											/>
											<button
												type="button"
												data-slot="crop-handle-sw"
												onPointerDown={(e) => handlePointerDown(e, "sw")}
												className="absolute -bottom-1.5 -left-1.5 size-3.5 cursor-nesw-resize rounded-sm border border-monti-default bg-monti-emphasis p-0"
												aria-label={t("imageCrop.handleSw")}
											/>
											<button
												type="button"
												data-slot="crop-handle-se"
												onPointerDown={(e) => handlePointerDown(e, "se")}
												className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize rounded-sm border border-monti-default bg-monti-emphasis p-0"
												aria-label={t("imageCrop.handleSe")}
											/>
										</div>
									</>
								)}
							</div>
						</div>

						<Inline width="full" wrap justify="between" gap="condensed">
							<Text variant="caption" tone="muted">
								{isFull
									? t("imageCrop.full")
									: t("imageCrop.region", {
											width: cropDraft.width,
											height: cropDraft.height,
											x: cropDraft.x,
											y: cropDraft.y,
										})}
							</Text>
						</Inline>

						{/* Keyboard numeric input controls */}
						<Inline
							width="full"
							justify="between"
							gap="condensed"
							padding="condensed"
							radius="lg"
							border="all"
							background="inset"
						>
							<Text variant="caption" tone="muted" weight="medium">
								{t("imageCrop.regionPercent")}
							</Text>
							<Grid columns={4} responsive={false} gap="condensed">
								<Inline gap="tight">
									<Label htmlFor="crop-input-x" size="caption" tone="muted">
										X
									</Label>
									<Input
										id="crop-input-x"
										type="number"
										size="sm"
										min={0}
										max={99}
										step={1}
										value={cropDraft.x}
										aria-label={t("imageCrop.x")}
										onChange={(e) => handleNumericCropChange("x", Number(e.target.value))}
									/>
								</Inline>
								<Inline gap="tight">
									<Label htmlFor="crop-input-y" size="caption" tone="muted">
										Y
									</Label>
									<Input
										id="crop-input-y"
										type="number"
										size="sm"
										min={0}
										max={99}
										step={1}
										value={cropDraft.y}
										aria-label={t("imageCrop.y")}
										onChange={(e) => handleNumericCropChange("y", Number(e.target.value))}
									/>
								</Inline>
								<Inline gap="tight">
									<Label htmlFor="crop-input-w" size="caption" tone="muted">
										W
									</Label>
									<Input
										id="crop-input-w"
										type="number"
										size="sm"
										min={1}
										max={100}
										step={1}
										value={cropDraft.width}
										aria-label={t("imageCrop.width")}
										onChange={(e) => handleNumericCropChange("width", Number(e.target.value))}
									/>
								</Inline>
								<Inline gap="tight">
									<Label htmlFor="crop-input-h" size="caption" tone="muted">
										H
									</Label>
									<Input
										id="crop-input-h"
										type="number"
										size="sm"
										min={1}
										max={100}
										step={1}
										value={cropDraft.height}
										aria-label={t("imageCrop.height")}
										onChange={(e) => handleNumericCropChange("height", Number(e.target.value))}
									/>
								</Inline>
							</Grid>
						</Inline>
					</Stack>

					{/* Rotation controls */}
					<Inline justify="between" padding="condensed" radius="lg" border="all" background="inset">
						<Inline gap="condensed">
							<Text variant="caption" weight="medium">
								{t("imageCrop.rotate")}
							</Text>
							<Text variant="caption" weight="semibold">
								{rotateDraft}°
							</Text>
						</Inline>
						<Button type="button" variant="outline" size="sm" onClick={handleRotate90}>
							<RotateCw aria-hidden />
							{t("imageCrop.rotate90")}
						</Button>
					</Inline>

					<DialogFooter>
						<Inline width="full" justify="between" gap="condensed">
							<Button type="button" variant="ghost" disabled={isFull && rotateDraft === 0} onClick={handleResetAll}>
								{tc("reset")}
							</Button>
							<Inline gap="condensed">
								<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
									{tc("cancel")}
								</Button>
								<Button type="submit">{tc("apply")}</Button>
							</Inline>
						</Inline>
					</DialogFooter>
				</Stack>
			</DialogContent>
		</Dialog>
	);
}
