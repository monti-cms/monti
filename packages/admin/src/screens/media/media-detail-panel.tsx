"use client";

import type { Folder } from "@monti-cms/core/site";
import { fileTypeLabel, formatFileSize, useSite, useTranslator, withBasePath } from "@monti-cms/core/site";
import { Check, Copy, ExternalLink } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { errorText } from "../../api/client";
import type { MediaItem } from "../../api/media";
import { formatBytes } from "../../editor/upload-helper";
import { commonMessages } from "../../lib/common.messages";
import { cn } from "../../lib/utils/cn";
import { type SlotRequest, SlotScope } from "../../slots/slots";
import { Button, buttonVariants } from "../../ui/button";
import { FormField, FormFieldError, FormFieldLabel } from "../../ui/field";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { EditorFooter } from "../shared/editor-footer";
import { entryHref } from "../shared/entry-href";
import { formatDateTime } from "../shared/format-date";
import { SidePanelHeader } from "../shared/side-panel";
import { useDraftEditor } from "../shared/use-draft-editor";
import {
	copyText,
	mediaUsages,
	splitFilename,
	stemProblem,
	usageCount,
	usageNoteLabel,
	withExtension,
} from "./media-item";
import { MediaThumb } from "./media-views";
import { mediaMessages } from "./messages";

/** One group in the detail. A small title, with the content below it. */
function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3 border-t px-4 py-4">
			<h3 className="font-medium text-monti-caption text-monti-muted-foreground uppercase tracking-wide">{title}</h3>
			{children}
		</section>
	);
}

/** Item name on top, value below. Long values (ID, file name) do not push out the name column. */
function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="space-y-0.5">
			<dt className="text-monti-caption text-monti-muted-foreground">{label}</dt>
			<dd className="break-all">{children}</dd>
		</div>
	);
}

function folderPath(folder: Folder, folders: Folder[]): string {
	const parts: string[] = [folder.name];
	let curr = folder;
	while (curr.parentId) {
		const parent = folders.find((f) => f.id === curr.parentId);
		if (!parent) break;
		parts.unshift(parent.name);
		curr = parent;
	}
	return parts.join(" / ");
}

/**
 * Media detail. Opens on the right whichever view (grid or list) it was picked from.
 * From the top: preview -> immediate actions (copy URL/ID, open) -> info -> default description (images) -> usages -> delete.
 * The file name (its stem; the extension stays) and the default description are inputs with an AI button beside them (file name, alt text, caption
 * suggestions). A suggestion only fills the input. The name is saved by its own button and the default description by pressing `Save`;
 * unsaved changes are reported through `onDirtyChange` (used to ask before opening or closing another file).
 */
export function MediaDetailPanel({
	media,
	folders,
	className,
	onClose,
	onSaveDefaults,
	onRename,
	onMoveFolder,
	onRequestDelete,
	onDirtyChange,
}: {
	media: MediaItem;
	folders?: Folder[];
	className?: string;
	onClose: () => void;
	/** Saves the default description. Rejects on failure. The error shows inside the field. */
	onSaveDefaults: (defaults: { alt: string; caption: string }) => Promise<void>;
	/** Renames the file (the whole new name, extension included). Rejects on failure. The error shows under the field. */
	onRename: (filename: string) => Promise<void>;
	/** Moves the file to another folder (or null for root). */
	onMoveFolder?: (folderId: string | null) => Promise<void>;
	onRequestDelete: () => void;
	onDirtyChange?: (dirty: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const tc = useTranslator(commonMessages);
	const [movingFolder, setMovingFolder] = useState(false);
	const altId = useId();
	const captionId = useId();
	// The last saved (initially loaded) value. If the edited value differs, there are unsaved changes.
	const [saved, setSaved] = useState({ alt: media.defaultAlt, caption: media.defaultCaption });
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const isImage = site.api.isImageType(media.mimeType);
	const { draft, update: setDraft, dirty } = useDraftEditor({ saved, empty: saved, saving: isSaving });

	// The file name is edited as its stem; the extension stays. After a rename the draft starts from the new name.
	const { stem: savedStem, extension } = splitFilename(media.filename);
	const [stem, setStem] = useState(savedStem);
	const [renaming, setRenaming] = useState(false);
	const [renameError, setRenameError] = useState<string | null>(null);
	const [prevSavedStem, setPrevSavedStem] = useState(savedStem);
	if (prevSavedStem !== savedStem) {
		setPrevSavedStem(savedStem);
		setStem(savedStem);
	}
	const nameDirty = stem !== savedStem;
	const problem = stemProblem(stem);
	const nameFieldId = useId();
	const nameErrorId = useId();

	// Both forms report to the parent as one: leaving with either one unsaved asks first.
	const anyDirty = dirty || nameDirty;
	useEffect(() => onDirtyChange?.(anyDirty), [anyDirty, onDirtyChange]);
	useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

	const saveName = async () => {
		if (!nameDirty || problem) return;
		setRenaming(true);
		setRenameError(null);
		try {
			await onRename(`${stem.trim()}${extension}`);
		} catch (error) {
			setRenameError(errorText(site, error, t("library.renameFailed")));
		} finally {
			setRenaming(false);
		}
	};

	const saveDefaults = async () => {
		setIsSaving(true);
		setSaveError(null);
		try {
			await onSaveDefaults(draft);
			setSaved(draft);
		} catch (error) {
			setSaveError(errorText(site, error, tc("saveFailed")));
		} finally {
			setIsSaving(false);
		}
	};

	/** Media file slot. Looks at the image content and suggests a name and default description. */
	const slot = (target: "filename" | "defaultAlt" | "defaultCaption", apply: (value: string) => void): SlotRequest => ({
		slot: "media",
		target,
		scope: media.id,
		disabled: media.status !== "ready" || !isImage,
		getContext: () => ({
			mediaId: media.id,
			filename: media.filename,
			current: target === "filename" ? `${stem}${extension}` : target === "defaultAlt" ? draft.alt : draft.caption,
		}),
		apply,
	});

	const folderItems = useMemo(
		() => [
			{ value: "root", label: t("detail.folder.none") },
			...(folders ?? []).map((f) => ({ value: f.id, label: folderPath(f, folders ?? []) })),
		],
		[folders, t],
	);

	return (
		<aside
			aria-label={t("detail.label")}
			className={cn("flex h-full flex-col border-l bg-monti-background text-xs", className)}
		>
			<SidePanelHeader title={media.filename} onClose={onClose} />

			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="space-y-3 p-4">
					<div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-monti-muted/50">
						{isImage && media.publicUrl ? (
							<img src={media.publicUrl} alt="" className="max-h-full max-w-full object-contain" />
						) : (
							<span className="flex flex-col items-center gap-2 text-monti-muted-foreground">
								<MediaThumb media={media} iconClassName="size-12" />
								<span className="font-medium">{fileTypeLabel(media.filename, media.mimeType)}</span>
							</span>
						)}
					</div>
					<div className="flex flex-wrap gap-1.5">
						{media.publicUrl && (
							<>
								<Button
									type="button"
									variant="outline"
									size="xs"
									onClick={() => void copyText(media.publicUrl as string, t("detail.copiedUrl"), tc("copyFailed"))}
								>
									<Copy aria-hidden />
									{t("detail.copyUrl")}
								</Button>
								<a
									href={media.publicUrl}
									target="_blank"
									rel="noopener noreferrer"
									className={buttonVariants({ variant: "outline", size: "xs" })}
								>
									<ExternalLink aria-hidden />
									{tc("open")}
								</a>
							</>
						)}
						<Button
							type="button"
							variant="outline"
							size="xs"
							aria-label={t("detail.copyIdLabel")}
							onClick={() => void copyText(media.id, t("detail.copiedId"), tc("copyFailed"))}
						>
							<Copy aria-hidden />
							{t("detail.copyId")}
						</Button>
					</div>
				</div>

				<Section title={t("detail.section.info")}>
					<dl className="space-y-3">
						<SlotScope
							key={`filename-${media.id}`}
							request={slot("filename", (suggestion) => {
								// A suggestion comes without the extension; one that carries it is kept as is.
								setStem(splitFilename(withExtension(suggestion, media.filename)).stem);
								setRenameError(null);
							})}
						>
							{({ trigger, panel }) => (
								<form
									className="space-y-1"
									onSubmit={(event) => {
										event.preventDefault();
										void saveName();
									}}
								>
									<FormField data-invalid={problem && nameDirty ? true : undefined}>
										<div className="flex items-center justify-between gap-2">
											<FormFieldLabel htmlFor={nameFieldId}>{t("detail.row.filename")}</FormFieldLabel>
											{isImage && trigger}
										</div>
										<div className="flex items-center gap-1.5">
											<Input
												id={nameFieldId}
												value={stem}
												disabled={renaming || media.status !== "ready"}
												aria-invalid={(problem !== null && nameDirty) || renameError !== null || undefined}
												aria-describedby={renameError || (problem && nameDirty) ? nameErrorId : undefined}
												onChange={(event) => {
													setStem(event.target.value);
													setRenameError(null);
												}}
												className="h-8 min-w-0 flex-1 text-xs md:text-xs"
											/>
											{extension && (
												<span
													className="shrink-0 text-monti-muted-foreground"
													title={t("detail.filename.extensionKept")}
												>
													{extension}
												</span>
											)}
											<IconButton
												type="submit"
												label={t("detail.filename.save")}
												size="icon-sm"
												variant="outline"
												disabled={!nameDirty || problem !== null || renaming}
											>
												<Check aria-hidden />
											</IconButton>
										</div>
										{(renameError || (problem && nameDirty)) && (
											<FormFieldError id={nameErrorId}>
												{renameError ??
													(problem === "empty" ? t("detail.filename.empty") : t("detail.filename.invalid"))}
											</FormFieldError>
										)}
									</FormField>
									{panel}
								</form>
							)}
						</SlotScope>
						<Row label={t("detail.row.type")}>
							{isImage ? (media.mimeType ?? "—") : fileTypeLabel(media.filename, media.mimeType)}
						</Row>
						{isImage ? (
							<Row label={t("detail.row.public")}>
								{media.width}×{media.height} · {formatBytes(media.byteSize ?? 0)}
							</Row>
						) : (
							<Row label={t("detail.row.size")}>{formatFileSize(media.byteSize ?? 0)}</Row>
						)}
						{isImage && media.original && (
							<Row label={t("detail.row.original")}>
								{media.original.width}×{media.original.height} · {formatBytes(media.original.byteSize ?? 0)} ·{" "}
								{media.original.mimeType}
							</Row>
						)}
						{folders && (
							<Row label={t("detail.row.folder")}>
								<Select
									value={media.folderId ?? "root"}
									items={folderItems}
									disabled={movingFolder || !onMoveFolder}
									onValueChange={(val) => {
										if (!onMoveFolder) return;
										const nextId = val === "root" ? null : val;
										if (nextId === (media.folderId ?? null)) return;
										setMovingFolder(true);
										void onMoveFolder(nextId).finally(() => setMovingFolder(false));
									}}
								>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{folderItems.map((item) => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Row>
						)}
						<Row label={t("detail.row.uploadedAt")}>{formatDateTime(site, media.createdAt)}</Row>
						<Row label={t("detail.row.id")}>
							<code className="text-monti-caption">{media.id}</code>
						</Row>
					</dl>
				</Section>

				{isImage && (
					<Section title={t("detail.section.defaults")}>
						<p className="text-monti-muted-foreground">{t("detail.defaultsHelp")}</p>
						<form
							className="space-y-3"
							onSubmit={(event) => {
								event.preventDefault();
								void saveDefaults();
							}}
						>
							<SlotScope key={`alt-${media.id}`} request={slot("defaultAlt", (alt) => setDraft({ alt }))}>
								{({ trigger, panel }) => (
									<FormField>
										<div className="flex items-center justify-between gap-2">
											<FormFieldLabel htmlFor={altId}>{t("detail.defaultAlt")}</FormFieldLabel>
											{trigger}
										</div>
										<Textarea
											id={altId}
											rows={2}
											value={draft.alt}
											disabled={isSaving}
											onChange={(event) => setDraft({ alt: event.target.value })}
											className="min-h-14 text-xs md:text-xs"
										/>
										{panel}
									</FormField>
								)}
							</SlotScope>
							<SlotScope
								key={`caption-${media.id}`}
								request={slot("defaultCaption", (caption) => setDraft({ caption }))}
							>
								{({ trigger, panel }) => (
									<FormField>
										<div className="flex items-center justify-between gap-2">
											<FormFieldLabel htmlFor={captionId}>{t("detail.defaultCaption")}</FormFieldLabel>
											{trigger}
										</div>
										<Textarea
											id={captionId}
											rows={2}
											value={draft.caption}
											disabled={isSaving}
											onChange={(event) => setDraft({ caption: event.target.value })}
											className="min-h-14 text-xs md:text-xs"
										/>
										{panel}
									</FormField>
								)}
							</SlotScope>
							<EditorFooter
								dirty={dirty}
								saving={isSaving}
								canSave={media.status === "ready"}
								error={saveError}
								align="end"
							/>
						</form>
					</Section>
				)}

				<Section title={t("detail.section.usage", { count: usageCount(media) })}>
					{media.referencesCount === 0 ? (
						<p className="text-monti-muted-foreground">{t("detail.noUsage")}</p>
					) : (
						<ul className="space-y-1">
							{mediaUsages(media).map((usage) => (
								<li key={usage.entryId}>
									<a
										href={withBasePath(entryHref(site, usage.collection, usage.entryId))}
										className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-monti-accent"
									>
										<span className="min-w-0 flex-1 truncate">{usage.title || tc("untitled")}</span>
										{usage.note && (
											<span className="shrink-0 text-monti-muted-foreground text-xs">
												{usageNoteLabel(t, usage.note)}
											</span>
										)}
									</a>
								</li>
							))}
						</ul>
					)}
				</Section>
			</div>

			<div className="shrink-0 space-y-1.5 border-t px-4 py-3">
				<Button
					type="button"
					variant="destructive"
					size="sm"
					className="w-full"
					disabled={media.referencesCount > 0}
					onClick={onRequestDelete}
				>
					{media.status === "deleting" ? t("detail.retryDelete") : tc("delete")}
				</Button>
				{media.referencesCount > 0 && (
					<p className="text-center text-monti-caption text-monti-muted-foreground">{t("detail.inUse")}</p>
				)}
			</div>
		</aside>
	);
}
