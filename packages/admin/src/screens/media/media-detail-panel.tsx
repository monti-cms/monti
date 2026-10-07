"use client";

import { fileTypeLabel, formatFileSize, useSite, useTranslator, withBasePath } from "@monti-cms/core/client";
import { Copy, ExternalLink } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { formatBytes } from "../../editor/upload-helper";
import { cn } from "../../lib/utils/cn";
import { type SlotRequest, SlotScope } from "../../slots/slots";
import { Button, buttonVariants } from "../../ui/button";
import { Field, FieldLabel } from "../../ui/field";
import { Textarea } from "../../ui/textarea";
import { errorText } from "../admin-api";
import { entryHref } from "../shared/entry-href";
import { formatDateTime } from "../shared/format-date";
import { SidePanelHeader } from "../shared/side-panel";
import { copyText, type MediaItem, mediaUsages, usageCount, usageNoteLabel, withExtension } from "./media-item";
import { MediaThumb } from "./media-views";
import { mediaMessages } from "./messages";

/** One group in the detail. A small title, with the content below it. */
function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3 border-t px-4 py-4">
			<h3 className="font-medium text-[11px] text-cms-muted-foreground uppercase tracking-wide">{title}</h3>
			{children}
		</section>
	);
}

/** Item name on top, value below. Long values (ID, file name) do not push out the name column. */
function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="space-y-0.5">
			<dt className="text-[11px] text-cms-muted-foreground">{label}</dt>
			<dd className="break-all">{children}</dd>
		</div>
	);
}

/**
 * Media detail. Opens on the right whichever view (grid or list) it was picked from.
 * From the top: preview -> immediate actions (copy URL/ID, open) -> info -> default description (images) -> usages -> delete.
 * Name and default description have AI slots (file name, alt text, caption suggestions). The default description is saved only by pressing `Save`,
 * and unsaved changes are reported through `onDirtyChange` (used to ask before opening or closing another file).
 */
export function MediaDetailPanel({
	media,
	className,
	onClose,
	onSaveDefaults,
	onRename,
	onRequestDelete,
	onDirtyChange,
}: {
	media: MediaItem;
	className?: string;
	onClose: () => void;
	/** Saves the default description. Rejects on failure. The error shows inside the field. */
	onSaveDefaults: (defaults: { alt: string; caption: string }) => Promise<void>;
	onRename: (filename: string) => void;
	onRequestDelete: () => void;
	onDirtyChange?: (dirty: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const altId = useId();
	const captionId = useId();
	// The last saved (initially loaded) value. If the edited value differs, there are unsaved changes.
	const [saved, setSaved] = useState({ alt: media.defaultAlt, caption: media.defaultCaption });
	const [draft, setDraft] = useState(saved);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const isImage = site.api.isImageMime(media.mimeType);
	const isDirty = draft.alt !== saved.alt || draft.caption !== saved.caption;
	useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

	const saveDefaults = async () => {
		setIsSaving(true);
		setSaveError(null);
		try {
			await onSaveDefaults(draft);
			setSaved(draft);
		} catch (error) {
			setSaveError(errorText(site, error, t("library.saveFailed")));
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
			current: target === "filename" ? media.filename : target === "defaultAlt" ? draft.alt : draft.caption,
		}),
		apply,
	});

	return (
		<aside
			aria-label={t("detail.label")}
			className={cn("flex h-full flex-col border-l bg-cms-background text-xs", className)}
		>
			<SidePanelHeader title={media.filename} onClose={onClose} />

			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="space-y-3 p-4">
					<div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-cms-muted/50">
						{isImage && media.publicUrl ? (
							// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
							<img src={media.publicUrl} alt="" className="max-h-full max-w-full object-contain" />
						) : (
							<span className="flex flex-col items-center gap-2 text-cms-muted-foreground">
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
									onClick={() => void copyText(t, media.publicUrl as string, t("detail.copiedUrl"))}
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
									{t("common.open")}
								</a>
							</>
						)}
						<Button
							type="button"
							variant="outline"
							size="xs"
							aria-label={t("detail.copyIdLabel")}
							onClick={() => void copyText(t, media.id, t("detail.copiedId"))}
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
							request={slot("filename", (stem) => onRename(withExtension(stem, media.filename)))}
						>
							{({ trigger, panel }) => (
								<div className="space-y-1">
									<div className="flex items-start gap-1">
										<div className="min-w-0 flex-1">
											<Row label={t("detail.row.filename")}>{media.filename}</Row>
										</div>
										{isImage && trigger}
									</div>
									{panel}
								</div>
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
						<Row label={t("detail.row.uploadedAt")}>{formatDateTime(site, media.createdAt)}</Row>
						<Row label={t("detail.row.id")}>
							<code className="text-[11px]">{media.id}</code>
						</Row>
					</dl>
				</Section>

				{isImage && (
					<Section title={t("detail.section.defaults")}>
						<p className="text-cms-muted-foreground">{t("detail.defaultsHelp")}</p>
						<form
							className="space-y-3"
							onSubmit={(event) => {
								event.preventDefault();
								void saveDefaults();
							}}
						>
							<SlotScope
								key={`alt-${media.id}`}
								request={slot("defaultAlt", (alt) => setDraft((current) => ({ ...current, alt })))}
							>
								{({ trigger, panel }) => (
									<Field>
										<div className="flex items-center justify-between gap-2">
											<FieldLabel htmlFor={altId}>{t("detail.defaultAlt")}</FieldLabel>
											{trigger}
										</div>
										<Textarea
											id={altId}
											rows={2}
											value={draft.alt}
											disabled={isSaving}
											onChange={(event) => setDraft({ ...draft, alt: event.target.value })}
											className="min-h-14 text-xs md:text-xs"
										/>
										{panel}
									</Field>
								)}
							</SlotScope>
							<SlotScope
								key={`caption-${media.id}`}
								request={slot("defaultCaption", (caption) => setDraft((current) => ({ ...current, caption })))}
							>
								{({ trigger, panel }) => (
									<Field>
										<div className="flex items-center justify-between gap-2">
											<FieldLabel htmlFor={captionId}>{t("detail.defaultCaption")}</FieldLabel>
											{trigger}
										</div>
										<Textarea
											id={captionId}
											rows={2}
											value={draft.caption}
											disabled={isSaving}
											onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
											className="min-h-14 text-xs md:text-xs"
										/>
										{panel}
									</Field>
								)}
							</SlotScope>
							{saveError && (
								<p role="alert" className="text-cms-destructive">
									{saveError}
								</p>
							)}
							<div className="flex justify-end">
								<Button type="submit" size="sm" disabled={media.status !== "ready" || isSaving}>
									{isSaving ? t("common.saving") : t("common.save")}
								</Button>
							</div>
						</form>
					</Section>
				)}

				<Section title={t("detail.section.usage", { count: usageCount(media) })}>
					{media.referencesCount === 0 ? (
						<p className="text-cms-muted-foreground">{t("detail.noUsage")}</p>
					) : (
						<ul className="space-y-1">
							{mediaUsages(media).map((usage) => (
								<li key={usage.entryId}>
									<a
										href={withBasePath(entryHref(site, usage.collection, usage.entryId))}
										className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-cms-accent"
									>
										<span className="min-w-0 flex-1 truncate">{usage.title || t("common.untitled")}</span>
										{usage.note && (
											<span className="shrink-0 text-cms-muted-foreground text-xs">
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
					{media.status === "deleting" ? t("detail.retryDelete") : t("common.delete")}
				</Button>
				{media.referencesCount > 0 && (
					<p className="text-center text-[11px] text-cms-muted-foreground">{t("detail.inUse")}</p>
				)}
			</div>
		</aside>
	);
}
