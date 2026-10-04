"use client";

import { cmsApiUrl, createTranslator } from "@monti-cms/core/client";
import { computeImageTransform, resolveImageUrl } from "@monti-cms/core/mdx";
import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, Crop } from "lucide-react";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/utils/cn";
import { type SlotRequest, useSlot } from "../slots/slots";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import {
	BlockSettings,
	BlockSettingsField,
	ContainerToolbar,
	SELECTED_RING,
	ToolbarButton,
	useEditorEditable,
} from "./blocks/shared";
import { ImageCropDialog } from "./image-crop-dialog";
import { ALT_REQUIRED_MESSAGE } from "./image-insert-dialog";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

/** §4.3 너비 입력: 1~100% 또는 4096 이하의 양의 정수 px. 빈 값은 본문에 맞춤이다. */
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

/** 이미지 앞뒤의 본문 글자(자리 동작이 이미지를 글 흐름 안에서 설명할 때 쓴다). */
const AROUND_CHARS = 1500;
function surroundingText(editor: NodeViewProps["editor"], getPos: NodeViewProps["getPos"], nodeSize: number): string {
	const pos = typeof getPos === "function" ? getPos() : undefined;
	if (!editor || typeof pos !== "number") return "";
	const doc = editor.state.doc;
	const before = doc.textBetween(Math.max(0, pos - AROUND_CHARS), pos, "\n", " ");
	const after = doc.textBetween(pos + nodeSize, Math.min(doc.content.size, pos + nodeSize + AROUND_CHARS), "\n", " ");
	return `${before.trim()}\n${t("imageNode.marker")}\n${after.trim()}`;
}

const ALIGN_TOOLS = [
	{ value: "left", label: t("toolbar.alignLeftTitle"), icon: AlignLeft },
	{ value: "center", label: t("toolbar.alignCenterTitle"), icon: AlignCenter },
	{ value: "right", label: t("toolbar.alignRightTitle"), icon: AlignRight },
] as const;

export function CmsImageNodeView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
	const widthInputId = useId();
	const altInputId = useId();
	const widthErrorId = useId();
	const altErrorId = useId();
	const decorativeId = useId();
	/** AI 자리 구분값. 노드 뷰가 살아 있는 동안 같다(같은 이미지를 두 번 넣어도 따로다). */
	const slotScope = useId();
	const { src, alt, width, align, caption, mediaId, decorative, crop, rotate } = node.attrs;
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
	// 노드 뷰는 항상 편집기 안에서 그려지지만, 편집기 없이 그리는 경우(미리보기·테스트)도 막지 않는다.
	const isEditable = useEditorEditable(editor);
	/** 본문 이미지 자리(alt·캡션). 서버는 미디어 라이브러리 이미지와 이 사이트 주소(`/images/...`)의 이미지를 읽는다. */
	const siteSrc = typeof src === "string" && src.startsWith("/") && !src.startsWith("//") ? src : undefined;
	const imageSlot = (target: "alt" | "caption"): SlotRequest => ({
		slot: "image",
		target,
		scope: slotScope,
		disabled: !isEditable || (!mediaId && !siteSrc),
		getContext: () => ({
			mediaId: typeof mediaId === "string" ? mediaId : undefined,
			imageSrc: typeof mediaId === "string" ? undefined : siteSrc,
			around: surroundingText(editor, getPos, node.nodeSize),
			current: (target === "alt" ? alt : caption) || undefined,
		}),
		apply: (value) => updateAttributes(target === "alt" ? { alt: value, decorative: null } : { caption: value }),
	});
	const altSlot = useSlot(imageSlot("alt"));
	const captionSlot = useSlot(imageSlot("caption"));
	const [mediaState, setMediaState] = useState<{ status: string; publicUrl: string | null } | null>(null);

	const transform = computeImageTransform({
		crop,
		rotate,
		aspectRatio,
	});

	useEffect(() => {
		if (!mediaId || src) {
			setMediaState(null);
			return;
		}
		let cancelled = false;
		setMediaState({ status: "checking", publicUrl: null });
		fetch(cmsApiUrl(`/v1/media/${encodeURIComponent(mediaId)}`))
			.then(async (response) => {
				if (!response.ok) throw new Error("media_lookup_failed");
				return (await response.json()) as { status?: string; publicUrl?: string | null };
			})
			.then((result) => {
				if (!cancelled) setMediaState({ status: result.status ?? "unknown", publicUrl: result.publicUrl ?? null });
			})
			.catch(() => {
				if (!cancelled) setMediaState({ status: "lookup-failed", publicUrl: null });
			});
		return () => {
			cancelled = true;
		};
	}, [mediaId, src]);

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

	// 설명이 필요한 이미지는 대체 텍스트가 있어야 한다(넣기 대화 상자와 같은 규칙).
	const altMissing = decorative !== true && !String(alt ?? "").trim();

	const alignClasses =
		{
			left: "mr-auto",
			center: "mx-auto",
			right: "ml-auto",
		}[align as "left" | "center" | "right"] || "mx-auto";
	// 공개 화면(CmsImage)과 같게 캡션을 이미지 정렬 쪽에 맞춘다.
	const captionAlignClass =
		{
			left: "text-left",
			center: "text-center",
			right: "text-right",
		}[align as "left" | "center" | "right"] || "text-center";

	// 모서리(좌·우 아래) 핸들 드래그로 너비 조절 (c-editor.md §1.1)
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
			// 이동 없이 클릭만 한 경우 커밋하지 않는다(P1-4: 너비 미지정 이미지 보존).
			if (hasMoved && currentPreview && currentPreview !== (width || null) && isValidImageWidth(currentPreview)) {
				updateAttributes({ width: normalizeWidth(currentPreview) });
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

	// TipTap v3는 노드 뷰의 첫 자식이 `data-node-view-wrapper`를 가져야 한다.
	// 그 속성을 넣는 것이 `NodeViewWrapper`이고, 빠지면 "Please use the NodeViewWrapper
	// component for your node view"로 런타임에 터진다(이미지 있는 글에서 발생).
	return (
		<NodeViewWrapper
			as="figure"
			data-image-block
			className={cn(
				// 편집기 본문(prose)의 img 위아래 2em 여백이 회색 상자 안에 빈 띠로 보이지 않게 한다.
				"group group/container relative my-6 flex flex-col rounded-lg transition-all [&_img]:m-0",
				alignClasses,
				selected && SELECTED_RING,
			)}
			style={{ width: previewWidth || width || "100%", maxWidth: "100%" }}
		>
			{/* 블록 도구 줄: 정렬·설정·자르기. 삭제는 블록 손잡이 메뉴에 있다. */}
			{isEditable && (
				<ContainerToolbar label={t("imageNode.toolbar")}>
					{ALIGN_TOOLS.map((tool) => (
						<ToolbarButton
							key={tool.value}
							label={tool.label}
							pressed={(align || "center") === tool.value}
							onClick={() => updateAttributes({ align: tool.value })}
						>
							<tool.icon aria-hidden />
						</ToolbarButton>
					))}
					<Separator orientation="vertical" className="mx-0.5 cms-vertical:h-4" />
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
										updateAttributes({ width: e.target.value.trim() ? normalizeWidth(e.target.value) : null });
									}
								}}
								className="h-7 text-xs"
								placeholder={t("imageNode.widthPlaceholder")}
							/>
							{widthInvalid && (
								<p id={widthErrorId} role="alert" className="text-cms-destructive">
									{t("imageNode.widthInvalid")}
								</p>
							)}
						</BlockSettingsField>
						<BlockSettingsField
							label={t("imageDialog.alt")}
							htmlFor={altInputId}
							action={decorative !== true ? altSlot.trigger : undefined}
						>
							<Textarea
								id={altInputId}
								value={alt || ""}
								rows={2}
								disabled={decorative === true}
								aria-invalid={altMissing || undefined}
								aria-describedby={altMissing ? altErrorId : undefined}
								onChange={(e) => updateAttributes({ alt: e.target.value })}
								className="min-h-0 text-xs md:text-xs"
							/>
							{altMissing && (
								<p id={altErrorId} role="alert" className="text-cms-destructive">
									{ALT_REQUIRED_MESSAGE}
								</p>
							)}
							{altSlot.panel}
						</BlockSettingsField>
						<label htmlFor={decorativeId} className="flex items-center justify-between gap-2">
							<span className="text-cms-muted-foreground">{t("imageDialog.decorative")}</span>
							<Switch
								id={decorativeId}
								size="sm"
								checked={decorative === true}
								onCheckedChange={(checked) =>
									updateAttributes(checked ? { decorative: true, alt: "" } : { decorative: null })
								}
							/>
						</label>
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
						className="relative w-full max-w-full overflow-hidden rounded-md bg-cms-muted"
						style={{
							width: previewWidth || width || "100%",
							maxWidth: "100%",
							...transform.wrapperStyle,
						}}
					>
						{/* biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic and not next/image-compatible */}
						<img
							src={resolved && "url" in resolved ? resolved.url : ""}
							alt={alt || ""}
							className="rounded-md"
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
					<div className="relative overflow-hidden rounded-md bg-cms-muted">
						{/* biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic and not next/image-compatible */}
						<img
							src={resolved && "url" in resolved ? resolved.url : ""}
							alt={alt || ""}
							className="h-auto w-full rounded-md object-contain"
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
				<Skeleton role="status" aria-label={t("imageNode.loading")} className="h-48 w-full rounded-md" />
			) : (
				<div className="flex h-48 w-full items-center justify-center rounded-md bg-cms-muted text-cms-muted-foreground text-sm">
					{t("imageNode.unavailable")}
				</div>
			)}
			{resolveReason ? <p className="mt-1 text-center text-cms-destructive text-xs">{resolveReason}</p> : null}

			{/* Caption Input / Display */}
			<figcaption className={cn("mt-2 flex items-center gap-1", captionAlignClass)}>
				<Input
					type="text"
					value={caption || ""}
					placeholder={t("imageDialog.caption")}
					aria-label={t("imageNode.caption")}
					readOnly={!isEditable}
					onChange={(e) => updateAttributes({ caption: e.target.value })}
					className={cn(
						"h-auto w-full rounded-none border-0 bg-transparent cms-dark:bg-transparent px-0 py-0 text-cms-muted-foreground text-xs shadow-none placeholder:text-cms-muted-foreground/50 focus-visible:ring-0 md:text-xs",
						captionAlignClass,
					)}
				/>
				{isEditable && captionSlot.trigger}
			</figcaption>
			{captionSlot.panel && <div className="mt-1 text-left">{captionSlot.panel}</div>}

			{/* 모서리(좌·우 아래) 너비 조절 핸들 */}
			{isEditable && (
				<>
					<button
						type="button"
						data-slot="resize-handle-left"
						aria-label={t("imageNode.resizeLeft")}
						onPointerDown={(e) => handleResizeStart(e, "left")}
						className="absolute -bottom-1 -left-1 z-20 size-3 cursor-ew-resize rounded-sm border border-cms-border bg-cms-background p-0 opacity-0 shadow-sm transition-opacity hover:scale-125 group-focus-within:opacity-100 group-hover:opacity-100"
					/>
					<button
						type="button"
						data-slot="resize-handle-right"
						aria-label={t("imageNode.resizeRight")}
						onPointerDown={(e) => handleResizeStart(e, "right")}
						className="absolute -right-1 -bottom-1 z-20 size-3 cursor-ew-resize rounded-sm border border-cms-border bg-cms-background p-0 opacity-0 shadow-sm transition-opacity hover:scale-125 group-focus-within:opacity-100 group-hover:opacity-100"
					/>
				</>
			)}

			{/* 자르기 및 회전 대화상자 */}
			{canRender && (
				<ImageCropDialog
					open={isCropDialogOpen}
					onOpenChange={setIsCropDialogOpen}
					src={resolved && "url" in resolved ? resolved.url : ""}
					crop={crop}
					rotate={rotate}
					onApply={({ crop: nextCrop, rotate: nextRotate }) => {
						updateAttributes({ crop: nextCrop, rotate: nextRotate });
					}}
				/>
			)}
		</NodeViewWrapper>
	);
}
