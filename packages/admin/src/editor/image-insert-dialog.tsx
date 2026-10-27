"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogFormFooter,
	DialogHeader,
	DialogTitle,
	FormFieldError,
	Grid,
	Image,
	Inline,
	Input,
	Label,
	PageTabs,
	Skeleton,
	Spinner,
	Stack,
	Switch,
	Tabs,
	TabsTrigger,
	Text,
	Textarea,
	Tile,
} from "@monti-cms/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { errorText } from "../api/client";
import { mediaNotConfiguredMessage } from "../api/error-message";
import { listMedia, type MediaItem, mediaKeys } from "../api/media";
import { commonMessages } from "../lib/common.messages";
import { useAdminFeatures } from "../screens/shared/admin-features";
import { useDebounced } from "../screens/shared/use-debounced";
import type { TranslatorFor } from "../translator";
import { submitOnEnter } from "./link-form";
import { editorMessages } from "./messages";
import { formatBytes, imageAccept, type PreparedUpload, prepareUpload, uploadImageFile } from "./upload-helper";

/** Notice for when an image that needs a description has no alt text. Shared by the insert dialog and image settings. */
export const altRequiredMessage = (t: TranslatorFor<typeof editorMessages>) => t("imageDialog.altRequired");

export interface ImageInsertion {
	mediaId: string;
	alt: string;
	decorative: boolean;
	caption: string;
	/** Public URL for the preview. `null` if not yet available. */
	publicUrl: string | null;
}

type LibraryItem = Pick<
	MediaItem,
	"id" | "filename" | "publicUrl" | "width" | "height" | "defaultAlt" | "defaultCaption"
>;

interface ImageInsertDialogProps {
	open: boolean;
	/** File that came in by paste or drag and drop. If present, opens the upload tab. */
	initialFile: File | null;
	onClose: () => void;
	onInsert: (image: ImageInsertion) => void;
	/** `pick` picks a single image without inserting it into the body (media field). Does not ask for alt text or caption. */
	mode?: "insert" | "pick";
	title?: string;
	/** Something fills in the alt text after the insert (`editor.imageInserted`), so it may be left empty here. */
	altLater?: boolean;
}

/**
 * Image insertion. Upload a new file (original kept by default, web optimization optional) or reuse from the library.
 * The library's default alt and caption are copied on insertion. An image that needs a description must have alt.
 */
export function ImageInsertDialog({
	open,
	initialFile,
	onClose,
	onInsert,
	mode = "insert",
	title: titleProp,
	altLater = false,
}: ImageInsertDialogProps) {
	const site = useSite();
	const t = useTranslator(editorMessages);
	const tc = useTranslator(commonMessages);
	const title = titleProp ?? t("imageDialog.title");
	const picking = mode === "pick";
	const { media } = useAdminFeatures();
	const altId = useId();
	const altErrorId = useId();
	const altLaterId = useId();
	const captionId = useId();
	const searchId = useId();
	const optimizeId = useId();
	const decorativeId = useId();
	const [tab, setTab] = useState<"upload" | "library">("upload");
	const [file, setFile] = useState<File | null>(null);
	const [optimize, setOptimize] = useState(false);
	const [prepared, setPrepared] = useState<PreparedUpload | null>(null);
	const [picked, setPicked] = useState<LibraryItem | null>(null);
	const [alt, setAlt] = useState("");
	const [caption, setCaption] = useState("");
	const [decorative, setDecorative] = useState(false);
	/** Show an empty alt text as an error once the alt field was touched or insert was pressed. */
	const [altTouched, setAltTouched] = useState(false);
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");

	useEffect(() => {
		if (!open) return;
		setTab(initialFile ? "upload" : "upload");
		setFile(initialFile);
		setOptimize(false);
		setPrepared(null);
		setPicked(null);
		setAlt("");
		setCaption("");
		setDecorative(false);
		setAltTouched(false);
		setProgress(null);
		setError(null);
	}, [open, initialFile]);

	useEffect(() => {
		let cancelled = false;
		if (!file) {
			setPrepared(null);
			return;
		}
		prepareUpload(site, file, { optimize }).then((result) => {
			if (!cancelled) setPrepared(result);
		});
		return () => {
			cancelled = true;
		};
	}, [file, optimize, site]);

	// The library list follows the typed name after a pause. The rows already shown stay while the next ones load.
	const debouncedSearch = useDebounced(search.trim(), 250);
	const libraryQuery = useQuery({
		queryKey: mediaKeys.list(`library:${debouncedSearch}`),
		queryFn: ({ signal }) => {
			const params = new URLSearchParams({ pageSize: "24", kind: "image" });
			if (debouncedSearch) params.set("search", debouncedSearch);
			return listMedia(site, params, signal);
		},
		enabled: open && tab === "library",
		placeholderData: keepPreviousData,
		retry: false,
	});
	const library = (libraryQuery.data?.items ?? []).filter((item) => item.status !== "deleting");
	const isLibraryLoading = open && tab === "library" && (libraryQuery.isFetching || search.trim() !== debouncedSearch);
	const libraryFailed = libraryQuery.isError;

	const isUploading = progress !== null;
	const needsAlt = !picking && !altLater && !decorative && !alt.trim();
	const hasImage = tab === "upload" ? Boolean(prepared) : Boolean(picked);
	const canInsert = !isUploading && !needsAlt && hasImage;
	const showAltError = needsAlt && altTouched;

	const pick = (item: LibraryItem) => {
		setPicked(item);
		setAlt(item.defaultAlt);
		setCaption(item.defaultCaption);
		setDecorative(false);
	};

	const confirm = async (event?: FormEvent<HTMLElement>) => {
		event?.preventDefault();
		if (needsAlt && hasImage) setAltTouched(true);
		if (!canInsert) return;
		setError(null);
		if (tab === "library" && picked) {
			onInsert({
				mediaId: picked.id,
				alt: decorative ? "" : alt.trim(),
				decorative,
				caption: caption.trim(),
				publicUrl: picked.publicUrl,
			});
			return;
		}
		if (!prepared) return;
		setProgress(0);
		try {
			const uploaded = await uploadImageFile(site, prepared, setProgress);
			onInsert({
				mediaId: uploaded.mediaId,
				alt: decorative ? "" : alt.trim(),
				decorative,
				caption: caption.trim(),
				publicUrl: uploaded.publicUrl,
			});
		} catch (err) {
			setError(errorText(site, err, t("imageDialog.uploadFailed")));
		} finally {
			setProgress(null);
		}
	};

	if (!media) {
		return (
			<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
				<DialogContent size="md">
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{mediaNotConfiguredMessage(site)}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose}>
							{tc("close")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !next && !isUploading && onClose()}>
			<DialogContent size="md" scroll showCloseButton={!isUploading}>
				<Stack
					as="form"
					gap={16}
					onSubmit={(event) => void confirm(event)}
					// Do not insert with the Enter that ends Korean composition. Enter also inserts in multi-line fields (Shift+Enter is a line break).
					onKeyDown={submitOnEnter}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{t("imageDialog.description")}</DialogDescription>
					</DialogHeader>

					<Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
						<PageTabs inset="none" aria-label={t("imageDialog.sourceLabel")}>
							<TabsTrigger value="upload" disabled={isUploading}>
								{tc("upload")}
							</TabsTrigger>
							<TabsTrigger value="library" disabled={isUploading}>
								{t("imageDialog.library")}
							</TabsTrigger>
						</PageTabs>
					</Tabs>

					{tab === "upload" ? (
						<Stack gap={8}>
							<Input
								type="file"
								aria-label={t("imageDialog.fileLabel")}
								accept={imageAccept(site)}
								disabled={isUploading}
								onChange={(event) => setFile(event.target.files?.[0] ?? null)}
							/>
							{file && (
								<>
									<Label htmlFor={optimizeId} size="body">
										<Switch
											id={optimizeId}
											checked={optimize}
											disabled={isUploading}
											onCheckedChange={(checked) => setOptimize(checked)}
										/>
										{t("imageDialog.optimize")}
									</Label>
									<Text as="p" variant="caption" tone="muted" aria-live="polite">
										{prepared?.optimized
											? `WebP · ${formatBytes(file.size)} → ${formatBytes(prepared.file.size)} · ${prepared.width}×${prepared.height}`
											: `${t("imageDialog.keepOriginal", { size: formatBytes(file.size) })}${prepared?.skippedReason ? ` · ${prepared.skippedReason}` : ""}`}
									</Text>
								</>
							)}
						</Stack>
					) : (
						<Stack gap={8}>
							<Label htmlFor={searchId} hidden>
								{t("imageDialog.search")}
							</Label>
							<Input
								id={searchId}
								value={search}
								placeholder={t("imageDialog.search")}
								onChange={(event) => setSearch(event.target.value)}
							/>
							<Stack gap={8} aria-busy={isLibraryLoading}>
								{isLibraryLoading && library.length === 0 && (
									<Grid columns={3} responsive={false} gap={8}>
										{["a", "b", "c"].map((key) => (
											<Skeleton key={key} shape="block" />
										))}
									</Grid>
								)}
								{libraryFailed && !isLibraryLoading && (
									<Alert tone="danger" layout="inline">
										<AlertDescription>{t("imageDialog.libraryFailed")}</AlertDescription>
										<Button type="button" size="sm" variant="secondary" onClick={() => void libraryQuery.refetch()}>
											{tc("retry")}
										</Button>
									</Alert>
								)}
								{library.length === 0 && !isLibraryLoading && !libraryFailed && (
									<Stack gap={0} paddingY={24} align="center">
										<Text as="p" tone="muted">
											{t("imageDialog.libraryEmpty")}
										</Text>
									</Stack>
								)}
								<Grid columns={3} responsive={false} gap={8}>
									{library.map((item) => (
										<Tile
											key={item.id}
											selected={picked?.id === item.id}
											onClick={() => pick(item)}
											title={item.filename}
											detail={item.publicUrl ? undefined : t("imageDialog.noPreview")}
											preview={
												<Image
													src={item.publicUrl ?? undefined}
													alt=""
													ratio="photo"
													radius="none"
													fallback={ImageIcon}
												/>
											}
										/>
									))}
								</Grid>
							</Stack>
						</Stack>
					)}

					<Stack gap={8} hidden={picking}>
						<Label htmlFor={altId}>{t("imageDialog.alt")}</Label>
						<Textarea
							id={altId}
							value={alt}
							rows={2}
							disabled={decorative || isUploading}
							aria-required={!decorative && !altLater}
							aria-invalid={showAltError || undefined}
							aria-describedby={showAltError ? altErrorId : altLater && !decorative ? altLaterId : undefined}
							onChange={(event) => {
								setAlt(event.target.value);
								setAltTouched(true);
							}}
							onBlur={() => setAltTouched(true)}
						/>
						{showAltError && <FormFieldError id={altErrorId}>{altRequiredMessage(t)}</FormFieldError>}
						{altLater && !decorative && !alt.trim() && (
							<Text as="p" id={altLaterId} variant="caption" tone="muted">
								{t("imageDialog.altLater")}
							</Text>
						)}
						<Label htmlFor={decorativeId} size="body">
							<Switch
								id={decorativeId}
								checked={decorative}
								disabled={isUploading}
								onCheckedChange={(checked) => setDecorative(checked)}
							/>
							{t("imageDialog.decorative")}
						</Label>
						<Label htmlFor={captionId}>{t("imageDialog.caption")}</Label>
						<Textarea
							id={captionId}
							value={caption}
							rows={2}
							disabled={isUploading}
							onChange={(event) => setCaption(event.target.value)}
						/>
					</Stack>

					{isUploading && (
						<Inline as="div" role="status" gap={8}>
							<Spinner />
							<Text>{t("imageDialog.uploading", { percent: progress ?? 0 })}</Text>
						</Inline>
					)}
					{error && <FormFieldError>{error}</FormFieldError>}

					<DialogFormFooter
						onCancel={() => !isUploading && onClose()}
						disabled={isUploading || !hasImage}
						submitLabel={
							tab === "upload"
								? error
									? t("imageDialog.reupload")
									: picking
										? tc("upload")
										: t("imageDialog.insert")
								: picking
									? t("imageDialog.pick")
									: t("imageDialog.insert")
						}
						cancelLabel={tc("cancel")}
					/>
				</Stack>
			</DialogContent>
		</Dialog>
	);
}
