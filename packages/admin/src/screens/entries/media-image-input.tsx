"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Button, cn, FormFieldError, Inline, Text } from "@monti-cms/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileIcon, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { errorText } from "../../api/client";
import { mediaNotConfiguredMessage } from "../../api/error-message";
import { getMedia, mediaKeys } from "../../api/media";
import { ImageInsertDialog } from "../../editor/image-insert-dialog";
import { uploadAttachment } from "../../editor/upload-helper";
import { useAdminFeatures } from "../shared/admin-features";
import type { FieldInputProps } from "./field-inputs";
import { entriesMessages } from "./messages";

/** Media ID -> public URL. Shared by the input and the extension's preview. `null` if it cannot be loaded. */
const urls = new Map<string, string | null>();
const loading = new Set<string>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** Remembers the URL of the picked image. It is not fetched again. */
export function rememberMediaUrl(mediaId: string, url: string | null) {
	urls.set(mediaId, url);
	for (const listener of listeners) listener();
}

/** Public URL of a media ID. `null` if empty, not yet known, or failed to load. */
export function useMediaUrl(mediaId: string): string | null {
	const site = useSite();
	const url = useSyncExternalStore(
		subscribe,
		() => (mediaId ? urls.get(mediaId) : undefined),
		() => undefined,
	);
	useEffect(() => {
		if (!mediaId || urls.has(mediaId) || loading.has(mediaId)) return;
		loading.add(mediaId);
		getMedia(site, mediaId)
			.then((media) => rememberMediaUrl(mediaId, media.publicUrl ?? null))
			.catch(() => rememberMediaUrl(mediaId, null))
			.finally(() => loading.delete(mediaId));
	}, [mediaId, site]);
	return mediaId ? (url ?? null) : null;
}

/** The size of the small preview in an input row. */
const INLINE_THUMBNAIL = "aspect-[1.91/1] h-7 shrink-0 rounded-md border";

/**
 * Image preview. Shows an icon if the URL is unknown. `size="inline"` is the small preview beside an input; `className` stays for plugins
 * (`@monti-cms/admin/kit`) that size it themselves.
 */
export function MediaThumbnail({ mediaId, size, className }: { mediaId: string; size?: "inline"; className?: string }) {
	const url = useMediaUrl(mediaId);
	const sized = cn(size === "inline" && INLINE_THUMBNAIL, className);
	// design-system: needs an image thumbnail part (fixed ratio, cover, an icon while the URL is unknown)
	return url ? (
		<img src={url} alt="" className={cn("object-cover", sized)} />
	) : (
		<div className={cn("flex items-center justify-center bg-monti-neutral text-monti-muted", sized)}>
			<ImageIcon aria-hidden className="size-4" />
		</div>
	);
}

/** Default input of a media field (`fields.media`). Picks a file if `accept` is `file`, otherwise an image. */
export function MediaInput(props: FieldInputProps) {
	return props.field.kind === "media" && props.field.accept === "file" ? (
		<MediaFileInput {...props} />
	) : (
		<MediaImageInput {...props} />
	);
}

/** Picks an image from the media library and shows the picked image small. */
export function MediaImageInput({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const t = useTranslator(entriesMessages);
	const site = useSite();
	const { media } = useAdminFeatures();
	const [picking, setPicking] = useState(false);
	const mediaId = typeof value === "string" ? value : "";
	return (
		<>
			<Inline gap="condensed">
				{mediaId && <MediaThumbnail mediaId={mediaId} size="inline" />}
				<Box grow>
					<Button
						id={id}
						type="button"
						size="sm"
						variant="outline"
						width="full"
						disabled={context.disabled || !media}
						title={media ? undefined : mediaNotConfiguredMessage(site)}
						aria-invalid={invalid || undefined}
						aria-describedby={describedBy}
						onClick={() => setPicking(true)}
					>
						{mediaId ? t("media.change") : t("media.chooseImage")}
					</Button>
				</Box>
				{mediaId && (
					<Button type="button" size="sm" variant="ghost" disabled={context.disabled} onClick={() => onChange("")}>
						{t("media.remove")}
					</Button>
				)}
			</Inline>
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

/** Uploads and picks one file. The picked file is shown by its file name. */
function MediaFileInput({ id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const t = useTranslator(entriesMessages);
	const site = useSite();
	const { media } = useAdminFeatures();
	const mediaId = typeof value === "string" ? value : "";
	const fileInput = useRef<HTMLInputElement>(null);
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const lookup = useQuery({
		queryKey: mediaKeys.detail(mediaId),
		queryFn: ({ signal }) => getMedia(site, mediaId, signal),
		enabled: mediaId !== "",
		retry: false,
	});
	const filename = mediaId ? (lookup.data?.filename ?? null) : null;
	const upload = async (file: File) => {
		setError(null);
		setProgress(0);
		try {
			const uploaded = await uploadAttachment(site, file, setProgress);
			// Show the name right away; the lookup confirms it.
			queryClient.setQueryData(mediaKeys.detail(uploaded.mediaId), {
				filename: file.name,
				byteSize: file.size,
				mimeType: file.type,
			});
			onChange(uploaded.mediaId);
		} catch (cause) {
			setError(errorText(site, cause, t("media.uploadFailed")));
		} finally {
			setProgress(null);
		}
	};
	return (
		<>
			<Inline gap="condensed">
				{mediaId && (
					<Inline gap="tight" grow minWidth={0}>
						<FileIcon aria-hidden size={14} />
						<Text variant="caption" truncate>
							{filename ?? mediaId}
						</Text>
					</Inline>
				)}
				<Box grow={!mediaId}>
					<Button
						id={id}
						type="button"
						size="sm"
						variant="outline"
						width={mediaId ? undefined : "full"}
						disabled={context.disabled || progress !== null || !media}
						title={media ? undefined : mediaNotConfiguredMessage(site)}
						aria-invalid={invalid || undefined}
						aria-describedby={describedBy}
						onClick={() => fileInput.current?.click()}
					>
						{progress !== null
							? t("media.uploading", { progress })
							: mediaId
								? t("media.change")
								: t("media.chooseFile")}
					</Button>
				</Box>
				{mediaId && (
					<Button type="button" size="sm" variant="ghost" disabled={context.disabled} onClick={() => onChange("")}>
						{t("media.remove")}
					</Button>
				)}
			</Inline>
			<input
				ref={fileInput}
				type="file"
				accept={site.api.FILE_ACCEPT}
				hidden
				aria-hidden
				tabIndex={-1}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void upload(file);
				}}
			/>
			{error && <FormFieldError>{error}</FormFieldError>}
		</>
	);
}
