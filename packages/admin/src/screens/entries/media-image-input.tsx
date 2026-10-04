"use client";

import { cmsApiUrl, FILE_ACCEPT } from "@monti-cms/core/client";
import { FileIcon, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ImageInsertDialog } from "../../editor/image-insert-dialog";
import { uploadAttachment } from "../../editor/upload-helper";
import { cn } from "../../lib/utils/cn";
import { Button } from "../../ui/button";
import { cmsFetch } from "../admin-api";
import type { FieldInputProps } from "./field-inputs";
import { t } from "./translate";

/** 미디어 ID → 공개 주소. 입력과 확장의 미리보기가 함께 쓴다. 불러오지 못하면 `null`. */
const urls = new Map<string, string | null>();
const loading = new Set<string>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** 고른 이미지의 주소를 기억한다. 다시 불러오지 않는다. */
export function rememberMediaUrl(mediaId: string, url: string | null) {
	urls.set(mediaId, url);
	for (const listener of listeners) listener();
}

/** 미디어 ID의 공개 주소. 비었거나 아직 모르거나 불러오지 못하면 `null`. */
export function useMediaUrl(mediaId: string): string | null {
	const url = useSyncExternalStore(
		subscribe,
		() => (mediaId ? urls.get(mediaId) : undefined),
		() => undefined,
	);
	useEffect(() => {
		if (!mediaId || urls.has(mediaId) || loading.has(mediaId)) return;
		loading.add(mediaId);
		cmsFetch<{ publicUrl: string | null }>(cmsApiUrl(`/v1/media/${mediaId}`))
			.then((media) => rememberMediaUrl(mediaId, media.publicUrl))
			.catch(() => rememberMediaUrl(mediaId, null))
			.finally(() => loading.delete(mediaId));
	}, [mediaId]);
	return mediaId ? (url ?? null) : null;
}

/** 이미지 미리보기. 주소를 모르면 아이콘을 보인다. */
export function MediaThumbnail({ mediaId, className }: { mediaId: string; className?: string }) {
	const url = useMediaUrl(mediaId);
	return url ? (
		// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
		<img src={url} alt="" className={cn("object-cover", className)} />
	) : (
		<div className={cn("flex items-center justify-center bg-cms-muted text-cms-muted-foreground", className)}>
			<ImageIcon aria-hidden className="size-4" />
		</div>
	);
}

/** 미디어 필드(`fields.media`)의 기본 입력. `accept`가 `file`이면 파일, 아니면 이미지를 고른다. */
export function MediaInput(props: FieldInputProps) {
	return props.field.kind === "media" && props.field.accept === "file" ? (
		<MediaFileInput {...props} />
	) : (
		<MediaImageInput {...props} />
	);
}

/** 미디어 라이브러리에서 이미지를 고르고, 고른 이미지를 작게 보여 준다. */
export function MediaImageInput({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const [picking, setPicking] = useState(false);
	const mediaId = typeof value === "string" ? value : "";
	return (
		<>
			<div className="flex items-center gap-1.5">
				{mediaId && <MediaThumbnail mediaId={mediaId} className="aspect-[1.91/1] h-7 shrink-0 rounded border" />}
				<Button
					id={id}
					type="button"
					size="sm"
					variant="outline"
					className="h-7 flex-1 text-xs"
					disabled={context.disabled}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					onClick={() => setPicking(true)}
				>
					{mediaId ? t("media.change") : t("media.chooseImage")}
				</Button>
				{mediaId && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-7 text-xs"
						disabled={context.disabled}
						onClick={() => onChange("")}
					>
						{t("media.remove")}
					</Button>
				)}
			</div>
			<ImageInsertDialog
				open={picking}
				initialFile={null}
				mode="pick"
				title={field.label}
				onClose={() => setPicking(false)}
				onInsert={(image) => {
					rememberMediaUrl(image.mediaId, image.publicUrl);
					onChange(image.mediaId);
					setPicking(false);
				}}
			/>
		</>
	);
}

/** 파일 하나를 올려 고른다. 고른 파일은 파일 이름으로 보인다. */
function MediaFileInput({ id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const mediaId = typeof value === "string" ? value : "";
	const fileInput = useRef<HTMLInputElement>(null);
	const [filename, setFilename] = useState<string | null>(null);
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		setFilename(null);
		if (!mediaId) return;
		let cancelled = false;
		cmsFetch<{ filename?: string }>(cmsApiUrl(`/v1/media/${mediaId}`))
			.then((media) => !cancelled && setFilename(media.filename ?? null))
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [mediaId]);
	const upload = async (file: File) => {
		setError(null);
		setProgress(0);
		try {
			const uploaded = await uploadAttachment(file, setProgress);
			setFilename(file.name);
			onChange(uploaded.mediaId);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("media.uploadFailed"));
		} finally {
			setProgress(null);
		}
	};
	return (
		<>
			<div className="flex items-center gap-1.5">
				{mediaId && (
					<span className="flex min-w-0 flex-1 items-center gap-1 text-xs">
						<FileIcon aria-hidden className="size-3.5 shrink-0 text-cms-muted-foreground" />
						<span className="truncate">{filename ?? mediaId}</span>
					</span>
				)}
				<Button
					id={id}
					type="button"
					size="sm"
					variant="outline"
					className={cn("h-7 text-xs", !mediaId && "flex-1")}
					disabled={context.disabled || progress !== null}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					onClick={() => fileInput.current?.click()}
				>
					{progress !== null ? t("media.uploading", { progress }) : mediaId ? t("media.change") : t("media.chooseFile")}
				</Button>
				{mediaId && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-7 text-xs"
						disabled={context.disabled}
						onClick={() => onChange("")}
					>
						{t("media.remove")}
					</Button>
				)}
			</div>
			<input
				ref={fileInput}
				type="file"
				accept={FILE_ACCEPT}
				hidden
				aria-hidden
				tabIndex={-1}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void upload(file);
				}}
			/>
			{error && (
				<p role="alert" className="text-cms-destructive text-xs">
					{error}
				</p>
			)}
		</>
	);
}
