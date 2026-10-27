"use client";

import { computeImageTransform, resolveImageUrl } from "@monti-cms/core/document";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { cn, FormFieldError, Inline, Input, Label, Separator, Skeleton, Stack, Switch, Textarea } from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { AlignCenter, AlignLeft, AlignRight, Crop, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { getMedia, mediaKeys } from "../api/media";
import { type SlotRequest, useSlot } from "../slots/slots";
import type { TranslatorFor } from "../translator";
import { BlockSettings, BlockSettingsField, ContainerToolbar, ToolbarButton } from "./blocks/shared";
import { BlockFrame, useBlockEditor } from "./blocks/use-block-editor";
import { ImageCropDialog } from "./image-crop-dialog";
import { altRequiredMessage } from "./image-insert-dialog";
import { useImageGenerating } from "./image-inserted";
import { editorMessages } from "./messages";

/** Width input: 1 to 100%, or a positive integer px of at most 4096. Empty means fit to the body. */
export const isValidImageWidth = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return true;
	const percent = /^(\d{1,3})%$/.exec(trimmed);
	if (percent) return Number(percent[1]) >= 1 && Number(percent[1]) <= 100;
	const px = /^(\d{1,4})(px)?$/.exec(trimmed);
	return Boolean(px) && Number(px?.[1]) >= 1 && Number(px?.[1]) <= 4096;
};

const normalizeWidth = (value: string) => {
	const trimmed = value.trim();
	return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
};

/** Body text before and after the image, for the slot action that describes the image within the text flow. */
const AROUND_CHARS = 1500;

/** A string value, or `fallback` when the attribute is unset. */
const text = (value: string | boolean | undefined, fallback = "") => (typeof value === "string" ? value : fallback);

const ALIGN_TOOLS = (t: TranslatorFor<typeof editorMessages>) =>
	[
		{ value: "left", label: t("toolbar.alignLeftTitle"), icon: AlignLeft },
		{ value: "center", label: t("toolbar.alignCenterTitle"), icon: AlignCenter },
		{ value: "right", label: t("toolbar.alignRightTitle"), icon: AlignRight },
	] as const;

/** Edit view of the core image block (`blockViews.image`). */
export function ImageBlockView() {
	const t = useTranslator(editorMessages);
	const site = useSite();
	const block = useBlockEditor();
	const widthInputId = useId();
	const altInputId = useId();
	const widthErrorId = useId();
	const altErrorId = useId();
	const decorativeId = useId();
	/**
	 * AI slot discriminator: the block id, so a run survives the view being re-created (a move, an undo). The same image inserted twice is separate.
	 * It stays the same while the view is alive, even when the editor assigns the id after the first render.
	 */
	const fallbackScope = useId();
	const slotScope = useRef(block.id ?? fallbackScope).current;
	const { values } = block;
	const src = text(values.src);
	const alt = text(values.alt);
	const width = text(values.width);
	const align = text(values.align);
	const caption = text(values.caption);
	const mediaId = text(values.mediaId);
	const decorative = values.decorative === true;
	const crop = text(values.crop) || null;
	const rotate = text(values.rotate) || null;
	const [isEditing, setIsEditing] = useState(false);
	const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
	const [previewWidth, setPreviewWidth] = useState<string | null>(null);
	const [aspectRatio, setAspectRatio] = useState<number | null>(null);
	const [widthDraft, setWidthDraft] = useState<string>(width || "");
	useEffect(() => setWidthDraft(width || ""), [width]);
	const widthInvalid = !isValidImageWidth(widthDraft);
	const activeResizeCleanupRef = useRef<(() => void) | null>(null);
	useEffect(() => {
		return () => {
			activeResizeCleanupRef.current?.();
		};
	}, []);
	const isEditable = block.editable;
	/** `editor.imageInserted` subscribers are still filling in this image's text. */
	const generating = useImageGenerating(block.id);
	/** Body image slot (alt, caption). The server reads media library images and images at this site's addresses (`/images/...`). */
	const siteSrc = src.startsWith("/") && !src.startsWith("//") ? src : undefined;
	const imageSlot = (target: "alt" | "caption"): SlotRequest => ({
		slot: "image",
		target,
		scope: slotScope,
		disabled: !isEditable || (!mediaId && !siteSrc),
		getContext: () => ({
			mediaId: mediaId || undefined,
			imageSrc: mediaId ? undefined : siteSrc,
			around: block.textAround(AROUND_CHARS, t("imageNode.marker")),
			current: (target === "alt" ? alt : caption) || undefined,
		}),
		apply: (value) => {
			block.setValues(target === "alt" ? { alt: value, decorative: null } : { caption: value });
		},
	});
	const altSlot = useSlot(imageSlot("alt"));
	const captionSlot = useSlot(imageSlot("caption"));

	const transform = computeImageTransform({
		crop,
		rotate,
		aspectRatio,
	});

	// An image kept as a library media (no `src` in the document) looks its status and public address up.
	const lookup = useQuery({
		queryKey: mediaKeys.detail(mediaId),
		queryFn: ({ signal }) => getMedia(site, mediaId, signal),
		enabled: mediaId !== "" && !src,
		retry: false,
	});
	const mediaState =
		!mediaId || src
			? null
			: lookup.isError
				? { status: "lookup-failed", publicUrl: null }
				: lookup.data
					? { status: lookup.data.status ?? "unknown", publicUrl: lookup.data.publicUrl ?? null }
					: { status: "checking", publicUrl: null };

	const imageSrc = typeof src === "string" && src ? src : mediaState?.publicUrl;
	const resolved = resolveImageUrl(typeof imageSrc === "string" ? imageSrc : undefined);
	const canRender = resolved !== null && "url" in resolved;
	const isChecking = !canRender && !src && !!mediaId && (!mediaState || mediaState.status === "checking");
	const resolveReason =
		canRender || isChecking
			? null
			: src
				? t("imageNode.urlNotAllowed")
				: !mediaId
					? t("imageNode.noUrl")
					: mediaState?.status === "pending"
						? t("imageNode.pending")
						: mediaState?.status === "failed"
							? t("imageNode.failed")
							: mediaState?.status === "missing"
								? t("imageNode.missing")
								: mediaState?.status === "lookup-failed"
									? t("imageNode.lookupFailed")
									: t("imageNode.unresolvable");

	// An image that needs a description must have alt text (same rule as the insert dialog).
	const altMissing = !decorative && !String(alt ?? "").trim();

	const alignClasses =
		{
			left: "mr-auto",
			center: "mx-auto",
			right: "ml-auto",
		}[align as "left" | "center" | "right"] || "mx-auto";
	// Align the caption to the image alignment, same as the public page (CmsImage).
	const captionAlignClass =
		{
			left: "text-left",
			center: "text-center",
			right: "text-right",
		}[align as "left" | "center" | "right"] || "text-center";
	const captionJustifyClass =
		{
			left: "justify-start",
			center: "justify-center",
			right: "justify-end",
		}[align as "left" | "center" | "right"] || "justify-center";

	// Resize width by dragging a corner (bottom left/right) handle
	const handleResizeStart = (e: React.PointerEvent, handle: "left" | "right") => {
		if (!isEditable) return;
		e.preventDefault();
		e.stopPropagation();

		const figure = (e.currentTarget as HTMLElement).closest("figure");
		if (!figure) return;

		activeResizeCleanupRef.current?.();

		const startX = e.clientX;
		const initialRect = figure.getBoundingClientRect();
		const parentRect = figure.parentElement?.getBoundingClientRect() ?? initialRect;
		const startWidth = initialRect.width;
		const parentWidth = parentRect.width || initialRect.width;
		const isPercent = typeof width === "string" && width.trim().endsWith("%");
		let currentPreview = width || `${Math.round(startWidth)}px`;
		let hasMoved = false;

		const onPointerMove = (moveEvent: PointerEvent) => {
			const delta = handle === "right" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
			if (Math.abs(delta) >= 2) {
				hasMoved = true;
			}
			const newWidth = Math.max(20, startWidth + delta);
			if (isPercent) {
				const percent = Math.min(100, Math.max(1, Math.round((newWidth / parentWidth) * 100)));
				currentPreview = `${percent}%`;
			} else {
				const px = Math.min(4096, Math.max(20, Math.round(newWidth)));
				currentPreview = `${px}px`;
			}
			setPreviewWidth(currentPreview);
			setWidthDraft(currentPreview);
		};

		const cleanup = () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			activeResizeCleanupRef.current = null;
		};

		const onPointerUp = () => {
			cleanup();
			setPreviewWidth(null);
			// If clicked without moving, do not commit (preserve images with no width set).
			if (hasMoved && currentPreview && currentPreview !== (width || null) && isValidImageWidth(currentPreview)) {
				block.setValues({ width: normalizeWidth(currentPreview) });
			}
		};

		const onPointerCancel = () => {
			cleanup();
			setPreviewWidth(null);
			setWidthDraft(width || "");
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		activeResizeCleanupRef.current = cleanup;
	};

	// TipTap v3 requires the first child of a node view to have `data-node-view-wrapper`.
	// `NodeViewWrapper` adds that attribute, and omitting it crashes at runtime with "Please use the NodeViewWrapper
	// component for your node view" (seen in posts that contain images).
	return (
		<BlockFrame
			as="figure"
			framed={false}
			data-image-block
			className={cn(
				// Keep the 2em top/bottom margin of img in the editor body (prose) from showing as an empty strip inside the gray box.
				"group group/container relative my-monti-24 flex flex-col rounded-monti-lg transition-all [&_img]:m-0",
				alignClasses,
			)}
			style={{ width: previewWidth || width || "100%", maxWidth: "100%" }}
		>
			{/* Block toolbar row: alignment, settings, crop. Deleting is in the block handle menu. */}
			{isEditable && (
				<ContainerToolbar label={t("imageNode.toolbar")}>
					{ALIGN_TOOLS(t).map((tool) => (
						<ToolbarButton
							key={tool.value}
							label={tool.label}
							pressed={(align || "center") === tool.value}
							onClick={() => block.setValues({ align: tool.value })}
						>
							<tool.icon aria-hidden />
						</ToolbarButton>
					))}
					<Separator orientation="vertical" length="control" />
					<BlockSettings open={isEditing} onOpenChange={setIsEditing}>
						<BlockSettingsField label={t("imageNode.width")} htmlFor={widthInputId}>
							<Input
								id={widthInputId}
								value={widthDraft}
								aria-invalid={widthInvalid || undefined}
								aria-describedby={widthInvalid ? widthErrorId : undefined}
								onChange={(e) => {
									setWidthDraft(e.target.value);
									if (isValidImageWidth(e.target.value)) {
										block.setValues({ width: e.target.value.trim() ? normalizeWidth(e.target.value) : null });
									}
								}}
								size="sm"
								placeholder={t("imageNode.widthPlaceholder")}
							/>
							{widthInvalid && <FormFieldError id={widthErrorId}>{t("imageNode.widthInvalid")}</FormFieldError>}
						</BlockSettingsField>
						<BlockSettingsField
							label={t("imageDialog.alt")}
							htmlFor={altInputId}
							action={!decorative ? altSlot.trigger : undefined}
						>
							<Textarea
								id={altInputId}
								value={alt || ""}
								rows={2}
								disabled={decorative}
								aria-invalid={altMissing || undefined}
								aria-describedby={altMissing ? altErrorId : undefined}
								onChange={(e) => block.setValues({ alt: e.target.value })}
								size="sm"
							/>
							{altMissing && <FormFieldError id={altErrorId}>{altRequiredMessage(t)}</FormFieldError>}
							{altSlot.panel}
						</BlockSettingsField>
						<Inline justify="between" gap={8}>
							<Label htmlFor={decorativeId} size="caption" tone="muted">
								{t("imageDialog.decorative")}
							</Label>
							<Switch
								id={decorativeId}
								size="sm"
								checked={decorative}
								onCheckedChange={(checked) =>
									block.setValues(checked ? { decorative: true, alt: "" } : { decorative: null })
								}
							/>
						</Inline>
					</BlockSettings>
					{canRender && (
						<ToolbarButton label={t("imageCrop.title")} onClick={() => setIsCropDialogOpen(true)}>
							<Crop aria-hidden />
						</ToolbarButton>
					)}
				</ContainerToolbar>
			)}

			{/* Actual Image */}
			{canRender ? (
				transform.isTransformed ? (
					<div
						data-slot="image-transform-wrapper"
						className="relative w-full max-w-full overflow-hidden rounded-monti-md bg-monti-muted"
						style={{
							width: previewWidth || width || "100%",
							maxWidth: "100%",
							...transform.wrapperStyle,
						}}
					>
						<img
							src={resolved && "url" in resolved ? resolved.url : ""}
							alt={alt || ""}
							className="rounded-monti-md"
							onLoad={(e) => {
								const { naturalWidth, naturalHeight } = e.currentTarget;
								if (naturalWidth > 0 && naturalHeight > 0) {
									setAspectRatio(naturalWidth / naturalHeight);
								}
							}}
							style={transform.imageStyle}
						/>
					</div>
				) : (
					<div className="relative overflow-hidden rounded-monti-md bg-monti-muted">
						<img
							src={resolved && "url" in resolved ? resolved.url : ""}
							alt={alt || ""}
							className="h-auto w-full rounded-monti-md object-contain"
							onLoad={(e) => {
								const { naturalWidth, naturalHeight } = e.currentTarget;
								if (naturalWidth > 0 && naturalHeight > 0) {
									setAspectRatio(naturalWidth / naturalHeight);
								}
							}}
						/>
					</div>
				)
			) : isChecking ? (
				<Stack gap={0} role="status" aria-label={t("imageNode.loading")}>
					<Skeleton shape="block" />
					<Skeleton shape="block" />
				</Stack>
			) : (
				<div className="flex h-48 w-full items-center justify-center rounded-monti-md bg-monti-muted text-monti-body text-monti-muted">
					{t("imageNode.unavailable")}
				</div>
			)}
			{resolveReason ? (
				<p className="mt-monti-4 text-center text-monti-caption text-monti-danger">{resolveReason}</p>
			) : null}

			{/* Caption Input / Display */}
			<figcaption className={cn("mt-monti-8 flex items-center gap-monti-4", captionAlignClass)}>
				{/* While the text is being written, the empty caption's place says so. The field stays editable, and what is typed there is kept. */}
				<div className="relative w-full">
					<Input
						appearance="inline"
						size="sm"
						align={align === "left" ? "start" : align === "right" ? "end" : "center"}
						type="text"
						value={caption || ""}
						placeholder={generating && !caption ? "" : t("imageDialog.caption")}
						aria-label={t("imageNode.caption")}
						readOnly={!isEditable}
						onChange={(e) => block.setValues({ caption: e.target.value })}
					/>
					{generating && (
						<output
							className={cn(
								"pointer-events-none absolute inset-0 flex items-center gap-monti-8 text-monti-caption text-monti-subtle",
								caption ? "sr-only" : captionJustifyClass,
							)}
						>
							<Loader2 aria-hidden className="size-3 shrink-0 animate-spin" />
							{t("imageNode.generating")}
						</output>
					)}
				</div>
				{isEditable && captionSlot.trigger}
			</figcaption>
			{captionSlot.panel && <div className="mt-monti-4 text-left">{captionSlot.panel}</div>}

			{/* Corner (bottom left/right) width resize handles */}
			{isEditable && (
				<>
					<button
						type="button"
						data-slot="resize-handle-left"
						aria-label={t("imageNode.resizeLeft")}
						onPointerDown={(e) => handleResizeStart(e, "left")}
						className="absolute -bottom-1 -left-1 z-20 size-3 cursor-ew-resize rounded-monti-sm border border-monti-muted bg-monti-page p-0 opacity-0 transition-opacity hover:scale-125 group-focus-within:opacity-100 group-hover:opacity-100"
					/>
					<button
						type="button"
						data-slot="resize-handle-right"
						aria-label={t("imageNode.resizeRight")}
						onPointerDown={(e) => handleResizeStart(e, "right")}
						className="absolute -right-1 -bottom-1 z-20 size-3 cursor-ew-resize rounded-monti-sm border border-monti-muted bg-monti-page p-0 opacity-0 transition-opacity hover:scale-125 group-focus-within:opacity-100 group-hover:opacity-100"
					/>
				</>
			)}

			{/* Crop and rotate dialog */}
			{canRender && (
				<ImageCropDialog
					open={isCropDialogOpen}
					onOpenChange={setIsCropDialogOpen}
					src={resolved && "url" in resolved ? resolved.url : ""}
					crop={crop}
					rotate={rotate}
					onApply={({ crop: nextCrop, rotate: nextRotate }) => {
						block.setValues({ crop: nextCrop, rotate: nextRotate });
					}}
				/>
			)}
		</BlockFrame>
	);
}
