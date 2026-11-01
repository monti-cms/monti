"use client";

import { Crop, SettingsAdjust, TextAlignCenter, TextAlignLeft, TextAlignRight } from "@carbon/icons-react";
import { computeImageTransform, resolveImageUrl } from "@monti-cms/core/document";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	BlockBar,
	BlockBarButton,
	BlockBarSeparator,
	Count,
	cn,
	FormField,
	FormFieldError,
	FormFieldLabel,
	Input,
	Option,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ResizeCorner,
	Switch,
	Text,
	TextButton,
	UploadingImage,
} from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { useEditorState } from "@tiptap/react";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { getMedia, mediaKeys } from "../api/media";
import { isComposingKey } from "../lib/keyboard";
import { type SlotRequest, useSlot } from "../slots/slots";
import type { TranslatorFor } from "../translator";
import { BlockFrame, useBlockEditor } from "./blocks/use-block-editor";
import { acknowledgeImageCard, nextImageWithoutAlt, openImageCard, useImageCardRequested } from "./image-alt";
import { ImageCropSheet } from "./image-crop-sheet";
import { useImageUpload } from "./image-upload";
import {
	isValidImageWidth,
	moveImageResize,
	normalizeImageWidth,
	releaseImageResize,
	startImageResize,
} from "./image-width";
import { editorMediaMessages } from "./media.messages";

/** Body text before and after the image, for the slot action that describes the image within the text flow. */
const AROUND_CHARS = 1500;

/** A string value, or `fallback` when the attribute is unset. */
const text = (value: string | boolean | undefined, fallback = "") => (typeof value === "string" ? value : fallback);

/** The length alt text is meant to stay within, shown beside the field. It is guidance: nothing cuts the text. */
export const ALT_TEXT_LENGTH = 80;

const ALIGN_TOOLS = (t: TranslatorFor<typeof editorMediaMessages>) =>
	[
		{ value: "left", label: t("imageNode.alignLeft"), icon: TextAlignLeft },
		{ value: "center", label: t("imageNode.alignCenter"), icon: TextAlignCenter },
		{ value: "right", label: t("imageNode.alignRight"), icon: TextAlignRight },
	] as const;

/** Edit view of the core image block (`blockViews.image`). */
export function ImageBlockView() {
	const t = useTranslator(editorMediaMessages);
	const site = useSite();
	const block = useBlockEditor();
	const widthInputId = useId();
	const altInputId = useId();
	const widthErrorId = useId();
	const altErrorId = useId();
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
	const uploadId = text(values.uploadId);
	const decorative = values.decorative === true;
	const crop = text(values.crop) || null;
	const rotate = text(values.rotate) || null;
	/** The image is still going up: the picture the person gave, with the bar. */
	const upload = useImageUpload(uploadId || null);
	const uploading = uploadId !== "";
	const [isEditing, setIsEditing] = useState(false);
	// Opened from the to-dos or by "next image", the card holds the alt text alone, over the picture; the settings button opens the whole card.
	const [altOnly, setAltOnly] = useState(false);
	const picture = useRef<HTMLDivElement>(null);
	const [isCropOpen, setIsCropOpen] = useState(false);
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
	/** Body image slot (alt, caption). The server reads media library images and images at this site's addresses (`/images/...`). */
	const siteSrc = src.startsWith("/") && !src.startsWith("//") ? src : undefined;
	const imageSlot = (target: "alt" | "caption"): SlotRequest => ({
		slot: "image",
		target,
		scope: slotScope,
		disabled: !isEditable || (!mediaId && !siteSrc),
		// With text in the field the action asks again ("Again") instead of filling.
		filled: Boolean(target === "alt" ? alt : caption),
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

	// The card opens with the cursor in the alt text, also when "next image" or the to-do list asks for it.
	const altInput = useRef<HTMLInputElement>(null);
	const cardRequested = useImageCardRequested(block.id);
	useEffect(() => {
		if (!cardRequested || !block.id) return;
		setAltOnly(true);
		setIsEditing(true);
		acknowledgeImageCard(block.id);
	}, [cardRequested, block.id]);
	/** The next image that has no alt text, while this card is open. */
	const editor = block.raw.editor;
	const tracked = typeof editor?.on === "function" ? editor : null;
	const nextImage = useEditorState({
		editor: tracked,
		selector: ({ editor: current }) => (current && block.id ? nextImageWithoutAlt(current.state.doc, block.id) : null),
	});
	const goNext = () => {
		setIsEditing(false);
		if (nextImage && tracked) openImageCard(tracked, nextImage);
	};

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

	// An image that needs a description must have alt text.
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

	// Resize width by dragging a corner (bottom left/right) handle
	const handleResizeStart = (e: React.PointerEvent, handle: "left" | "right") => {
		if (!isEditable) return;
		e.preventDefault();
		e.stopPropagation();

		const figure = (e.currentTarget as HTMLElement).closest("figure");
		if (!figure) return;

		activeResizeCleanupRef.current?.();

		const initialRect = figure.getBoundingClientRect();
		const parentRect = figure.parentElement?.getBoundingClientRect() ?? initialRect;
		let resize = startImageResize({
			width,
			handle,
			startX: e.clientX,
			startWidth: initialRect.width,
			parentWidth: parentRect.width || initialRect.width,
		});

		const onPointerMove = (moveEvent: PointerEvent) => {
			resize = moveImageResize(resize, moveEvent.clientX);
			setPreviewWidth(resize.preview);
			setWidthDraft(resize.preview);
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
			const next = releaseImageResize(resize);
			if (next) block.setValues({ width: next });
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

	const nextButton = (
		<TextButton type="button" variant="quiet" onClick={goNext}>
			{t("imageNode.next")} <span className="text-monti-micro">↵</span>
		</TextButton>
	);
	const altField = (
		<FormField>
			<FormFieldLabel
				htmlFor={altInputId}
				action={
					<span className="flex items-center gap-monti-12">
						{alt && !decorative && (
							<Count>{t("imageNode.altCount", { count: alt.length, max: ALT_TEXT_LENGTH })}</Count>
						)}
						{!decorative && altSlot.trigger}
					</span>
				}
			>
				{t("imageNode.alt")}
			</FormFieldLabel>
			<Input
				id={altInputId}
				ref={altInput}
				value={alt || ""}
				disabled={decorative}
				aria-invalid={altMissing || undefined}
				aria-describedby={altMissing ? altErrorId : undefined}
				onChange={(e) => block.setValues({ alt: e.target.value })}
				onKeyDown={(event) => {
					// Enter in the text moves on: to the next image, or closes the card when there is none.
					if (event.key !== "Enter" || isComposingKey(event)) return;
					event.preventDefault();
					goNext();
				}}
			/>
			{altMissing && <FormFieldError id={altErrorId}>{t("imageNode.altRequired")}</FormFieldError>}
			{altSlot.panel}
		</FormField>
	);

	const showTools = isEditable && !uploading;
	// TipTap v3 requires the first child of a node view to have `data-node-view-wrapper`.
	// `NodeViewWrapper` adds that attribute, and omitting it crashes at runtime with "Please use the NodeViewWrapper
	// component for your node view" (seen in posts that contain images).
	return (
		<BlockFrame
			as="figure"
			framed={false}
			selectedRing={false}
			data-image-block
			className={cn(
				// Keep the 2em top/bottom margin of img in the editor body (prose) from showing as an empty strip inside the gray box.
				"group group/container relative my-monti-24 flex flex-col rounded-monti-lg transition-all [&_img]:m-0",
				alignClasses,
			)}
			// design-allow: width is the author's setting or the resize in progress
			style={{ width: previewWidth || width || "100%", maxWidth: "100%" }}
		>
			{/* The tool row above the image: alignment | settings | crop and rotate. Deleting is in the block handle's menu. */}
			{showTools && (
				<div
					contentEditable={false}
					className={cn(
						"absolute -top-monti-40 left-0 z-10 opacity-0 transition-opacity group-focus-within/container:opacity-100 group-hover/container:opacity-100 has-aria-expanded:opacity-100",
						(block.selected || isEditing) && "opacity-100",
					)}
				>
					<BlockBar aria-label={t("imageNode.toolbar")}>
						{ALIGN_TOOLS(t).map((tool) => (
							<BlockBarButton
								key={tool.value}
								label={tool.label}
								pressed={(align || "center") === tool.value}
								onClick={() => block.setValues({ align: tool.value })}
							>
								<tool.icon aria-hidden />
							</BlockBarButton>
						))}
						<BlockBarSeparator />
						<Popover
							open={isEditing}
							onOpenChange={(open) => {
								setIsEditing(open);
								setAltOnly(false);
							}}
						>
							<BlockBarButton
								label={t("imageNode.settings")}
								pressed={isEditing}
								trigger={(button) => <PopoverTrigger render={button} />}
							>
								<SettingsAdjust aria-hidden />
							</BlockBarButton>
							{altOnly ? (
								<PopoverContent
									anchor={picture}
									align="start"
									alignOffset={24}
									side="bottom"
									sideOffset={-16}
									width="dialog"
									initialFocus={altInput}
								>
									{altField}
									{nextImage && <div className="flex justify-end">{nextButton}</div>}
								</PopoverContent>
							) : (
								<PopoverContent align="start" width="md" initialFocus={altInput}>
									<FormField>
										<FormFieldLabel htmlFor={widthInputId}>{t("imageNode.width")}</FormFieldLabel>
										<Input
											id={widthInputId}
											value={widthDraft}
											aria-invalid={widthInvalid || undefined}
											aria-describedby={widthInvalid ? widthErrorId : undefined}
											onChange={(e) => {
												setWidthDraft(e.target.value);
												if (isValidImageWidth(e.target.value)) {
													block.setValues({
														width: e.target.value.trim() ? normalizeImageWidth(e.target.value) : null,
													});
												}
											}}
											placeholder={t("imageNode.widthPlaceholder")}
										/>
										{widthInvalid && <FormFieldError id={widthErrorId}>{t("imageNode.widthInvalid")}</FormFieldError>}
									</FormField>
									{altField}
									<Option spread>
										{t("imageNode.decorative")}
										<Switch
											checked={decorative}
											onCheckedChange={(checked) =>
												block.setValues(checked ? { decorative: true, alt: "" } : { decorative: null })
											}
										/>
									</Option>
									{nextImage && <div className="flex justify-end">{nextButton}</div>}
								</PopoverContent>
							)}
						</Popover>
						{canRender && (
							<BlockBarButton label={t("imageCrop.title")} onClick={() => setIsCropOpen(true)}>
								<Crop aria-hidden />
							</BlockBarButton>
						)}
					</BlockBar>
				</div>
			)}

			{/* Actual Image. A selected image has the 2px ink ring on the picture only; the caption stays outside it. */}
			<div
				ref={picture}
				className={cn("relative rounded-monti-md", block.selected && !uploading && "ring-2 ring-monti-contrast")}
			>
				{uploading ? (
					<UploadingImage
						src={upload?.preview}
						progress={upload?.percent ?? 0}
						label={t("imageNode.uploadingPercent", { percent: upload?.percent ?? 0 })}
					/>
				) : canRender ? (
					transform.isTransformed ? (
						<div
							data-slot="image-transform-wrapper"
							className="relative w-full max-w-full overflow-hidden rounded-monti-md bg-monti-muted"
							// design-allow: width and transform come from the author's setting and the crop in progress
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
								// design-allow: image transform computed from the crop and rotation
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
					<Text as="p" tone="subtle" role="status">
						{t("imageNode.loading")}
					</Text>
				) : (
					<div className="flex h-48 w-full items-center justify-center rounded-monti-md bg-monti-muted text-monti-body text-monti-muted">
						{t("imageNode.unavailable")}
					</div>
				)}
				{/* The corner handles at the bottom of the picture: dragging one changes the width. */}
				{showTools && (
					<span
						className={cn(
							"group-focus-within/container:opacity-100 group-hover/container:opacity-100",
							!block.selected && "opacity-0",
						)}
					>
						<ResizeCorner
							side="left"
							label={t("imageNode.resizeLeft")}
							onPointerDown={(e) => handleResizeStart(e, "left")}
						/>
						<ResizeCorner
							side="right"
							label={t("imageNode.resizeRight")}
							onPointerDown={(e) => handleResizeStart(e, "right")}
						/>
					</span>
				)}
			</div>
			{resolveReason && !uploading ? (
				<p className="mt-monti-4 text-center text-monti-caption text-monti-danger">{resolveReason}</p>
			) : null}

			{/* Caption Input / Display */}
			<figcaption className={cn("mt-monti-8 flex items-center gap-monti-8", captionAlignClass)}>
				<div className="relative w-full">
					<Input
						appearance="inline"
						size="sm"
						align={align === "left" ? "start" : align === "right" ? "end" : "center"}
						type="text"
						value={caption || ""}
						placeholder={t("imageNode.captionPlaceholder")}
						aria-label={t("imageNode.caption")}
						readOnly={!isEditable}
						onChange={(e) => block.setValues({ caption: e.target.value })}
					/>
				</div>
				{showTools && captionSlot.trigger}
			</figcaption>
			{!uploading && captionSlot.panel && <div className="mt-monti-4 text-left">{captionSlot.panel}</div>}

			{/* Crop and rotate sheet */}
			{canRender && (
				<ImageCropSheet
					open={isCropOpen}
					onOpenChange={setIsCropOpen}
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
