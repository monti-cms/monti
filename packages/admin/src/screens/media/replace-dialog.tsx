"use client";

import { Document } from "@carbon/icons-react";
import { formatFileSize, useSite, useTranslator } from "@monti-cms/core/site";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	FilePreview,
	FormFieldError,
	Grid,
	Image,
	Stack,
	Text,
} from "@monti-cms/ui";
import { useEffect, useMemo, useState } from "react";
import { errorText } from "../../api/client";
import type { MediaItem } from "../../api/media";
import { commonMessages } from "../../lib/common.messages";
import { usageCount } from "./media-item";
import { extensionOf, replaceProblem } from "./media-upload";
import { mediaMessages } from "./messages";

/** A file in the comparison: its picture or file icon, its name and its size. `quiet` is the file that goes away. */
function FileLine({
	name,
	size,
	picture,
	quiet = false,
}: {
	name: string;
	size: string;
	picture: string | null | undefined;
	quiet?: boolean;
}) {
	return (
		<Stack gap={8}>
			{picture !== undefined ? (
				<Image src={picture} alt="" ratio="photo" fallback={Document} />
			) : (
				<FilePreview ext={extensionOf(name).toUpperCase()} framed />
			)}
			<Stack gap={2}>
				<Text truncate tone={quiet ? "muted" : undefined}>
					{name}
				</Text>
				<Text variant="meta" tone="subtle" mono>
					{size}
				</Text>
			</Stack>
		</Stack>
	);
}

/** The width and height of a picture at `url` once it has loaded, or `null` while it has not (or cannot be read). */
function usePictureSize(url: string | undefined): { width: number; height: number } | null {
	const [size, setSize] = useState<{ width: number; height: number } | null>(null);
	useEffect(() => {
		setSize(null);
		if (!url) return;
		const probe = new window.Image();
		probe.onload = () => setSize({ width: probe.naturalWidth, height: probe.naturalHeight });
		probe.src = url;
		return () => {
			probe.onload = null;
		};
	}, [url]);
	return size;
}

/**
 * The question before a file is replaced: the file now and the new one side by side, and how many places that use it will use the new one. The name,
 * alt text and caption stay. The new file has to be the same kind (a picture for a picture, a file of the same type for a file); otherwise the dialog says so
 * and does not go on. While it goes up the button shows how far.
 */
export function ReplaceDialog({
	request,
	onClose,
	onReplace,
}: {
	request: { media: MediaItem; file: File } | null;
	onClose: () => void;
	onReplace: (media: MediaItem, file: File, onProgress: (percent: number) => void) => Promise<void>;
}) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const tc = useTranslator(commonMessages);
	const [percent, setPercent] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const { media, file } = request ?? {};
	const problem = media && file ? replaceProblem(site, media, file) : null;
	const uses = media ? usageCount(media) : 0;
	const picture = useMemo(
		() =>
			file instanceof File && file.type.startsWith("image/") && typeof URL.createObjectURL === "function"
				? URL.createObjectURL(file)
				: undefined,
		[file],
	);
	useEffect(() => () => (picture ? URL.revokeObjectURL(picture) : undefined), [picture]);
	const pictureSize = usePictureSize(picture);
	// biome-ignore lint/correctness/useExhaustiveDependencies: a new request starts clean
	useEffect(() => {
		setPercent(null);
		setError(null);
	}, [request]);

	const confirm = async () => {
		if (!media || !file || problem) return;
		setPercent(0);
		setError(null);
		try {
			await onReplace(media, file, setPercent);
			onClose();
		} catch (failure) {
			setError(errorText(site, failure, t("replace.failed")));
			setPercent(null);
		}
	};
	const busy = percent !== null;

	return (
		<AlertDialog open={request !== null} onOpenChange={(open) => !open && !busy && onClose()}>
			<AlertDialogContent size="wide">
				<AlertDialogHeader>
					<AlertDialogTitle>{t("replace.title")}</AlertDialogTitle>
				</AlertDialogHeader>
				{media && file && (
					<Grid columns="compare" responsive={false} gap={16}>
						<FileLine
							quiet
							name={media.filename}
							size={
								site.api.isImageType(media.mimeType)
									? `${media.width}×${media.height}`
									: formatFileSize(media.byteSize ?? 0)
							}
							picture={site.api.isImageType(media.mimeType) ? media.publicUrl : undefined}
						/>
						<Text as="span" aria-hidden tone="subtle">
							→
						</Text>
						<FileLine
							name={file.name}
							size={pictureSize ? `${pictureSize.width}×${pictureSize.height}` : formatFileSize(file.size)}
							picture={file.type.startsWith("image/") ? (picture ?? null) : undefined}
						/>
					</Grid>
				)}
				<Text as="p" tone="muted">
					{uses > 0 ? t("replace.body", { count: uses }) : t("replace.bodyUnused")}
				</Text>
				{problem && <FormFieldError>{problem === "kind" ? t("replace.kind") : t("replace.type")}</FormFieldError>}
				{error && <FormFieldError>{error}</FormFieldError>}
				<AlertDialogFooter>
					<AlertDialogCancel type="button" disabled={busy}>
						{tc("cancel")}
					</AlertDialogCancel>
					<Button type="button" disabled={problem !== null || busy} onClick={() => void confirm()}>
						{busy ? t("replace.busy", { percent: percent ?? 0 }) : t("replace.confirm")}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
