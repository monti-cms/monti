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

/** A file in the comparison: its picture or file icon, its name and its size. */
function FileLine({
	label,
	name,
	size,
	picture,
}: {
	label: string;
	name: string;
	size: string;
	picture: string | null | undefined;
}) {
	return (
		<Stack gap={8}>
			<Text variant="caption" tone="subtle">
				{label}
			</Text>
			{picture !== undefined ? (
				<Image src={picture} alt="" ratio="photo" fallback={Document} />
			) : (
				<FilePreview ext={extensionOf(name).toUpperCase()} framed />
			)}
			<Stack gap={2}>
				<Text truncate>{name}</Text>
				<Text variant="meta" tone="subtle" mono>
					{size}
				</Text>
			</Stack>
		</Stack>
	);
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
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("replace.title")}</AlertDialogTitle>
				</AlertDialogHeader>
				{media && file && (
					<Grid columns={2} gap={16}>
						<FileLine
							label={t("replace.from")}
							name={media.filename}
							size={
								site.api.isImageType(media.mimeType)
									? `${media.width}×${media.height}`
									: formatFileSize(media.byteSize ?? 0)
							}
							picture={site.api.isImageType(media.mimeType) ? media.publicUrl : undefined}
						/>
						<FileLine
							label={t("replace.to")}
							name={file.name}
							size={formatFileSize(file.size)}
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
