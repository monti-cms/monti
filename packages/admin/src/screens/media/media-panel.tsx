"use client";

import { Copy, FolderMoveTo, TrashCan } from "@carbon/icons-react";
import type { FolderListItem } from "@monti-cms/core/site";
import { formatFileSize, useSite, useTranslator, withBasePath } from "@monti-cms/core/site";
import {
	Box,
	Button,
	DescriptionItem,
	DescriptionList,
	FilePreview,
	FormField,
	FormFieldError,
	FormFieldLabel,
	Image,
	Inline,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SidePanel,
	Stack,
	Text,
	Textarea,
	TextButton,
} from "@monti-cms/ui";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { errorText } from "../../api/client";
import type { MediaItem } from "../../api/media";
import { commonMessages } from "../../lib/common.messages";
import { type SlotRequest, SlotScope } from "../../slots/slots";
import { type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { entryHref } from "../shared/entry-href";
import { formatDateTime } from "../shared/format-date";
import { useDraftEditor } from "../shared/use-draft-editor";
import { copyText, kindName, mediaUsages, placeNamer, splitFilename, stemProblem, usageCount } from "./media-item";
import { folderChoices } from "./media-state";
import { extensionOf } from "./media-upload";
import { mediaMessages } from "./messages";

/** A figure of the file (size, dimensions, day) in mono, the way the list writes them. */
const Numbers = ({ children }: { children: ReactNode }) => (
	<Text as="span" mono variant="meta" tone="muted">
		{children}
	</Text>
);

type Patch = { filename?: string; defaultAlt?: string; defaultCaption?: string; folderId?: string | null };

/**
 * The panel of an open file, beside the library. A picture has its name, folder, default alt text (with the assistant's fill) and caption, then its type,
 * size and the places it is used; any other file has no alt text or caption. One button saves everything that was changed. The ⋯ holds replacing the file,
 * the ID and the address, and the trash; a file that is not a picture also has replace and the trash as text buttons in the foot.
 */
export function MediaPanel({
	media,
	folders,
	onClose,
	onSave,
	onReplace,
	onTrash,
	onDirtyChange,
}: {
	media: MediaItem;
	folders: readonly FolderListItem[];
	onClose: () => void;
	/** Saves the changed fields in one request. Rejects on failure; the message shows in the panel. */
	onSave: (patch: Patch) => Promise<void>;
	/** Opens the file picker for the replacement. */
	onReplace: () => void;
	/** Moves the file to the trash. It does not ask: the toast that follows can undo it. */
	onTrash: () => void;
	onDirtyChange?: (dirty: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(mediaMessages);
	const tc = useTranslator(commonMessages);
	const nameId = useId();
	const nameErrorId = useId();
	const altId = useId();
	const captionId = useId();
	const isImage = site.api.isImageType(media.mimeType);
	const { stem: savedStem, extension } = splitFilename(media.filename);
	const saved = useMemo(
		() => ({ stem: savedStem, folderId: media.folderId ?? null, alt: media.defaultAlt, caption: media.defaultCaption }),
		[savedStem, media.folderId, media.defaultAlt, media.defaultCaption],
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { draft, update, dirty } = useDraftEditor({ saved, empty: saved, saving });
	useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
	useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

	const problem = stemProblem(draft.stem);
	const nameShown = problem !== null && draft.stem !== saved.stem;
	const choices = useMemo(() => folderChoices(folders), [folders]);
	const folderItems = [
		{ value: "root", label: t("bulk.top") },
		...choices.map(({ folder, depth }) => ({ value: folder.id, label: `${"  ".repeat(depth)}${folder.name}` })),
	];

	const submit = async () => {
		if (!dirty || problem) return;
		const patch: Patch = {};
		if (draft.stem !== saved.stem) patch.filename = `${draft.stem.trim()}${extension}`;
		if (draft.folderId !== saved.folderId) patch.folderId = draft.folderId;
		if (draft.alt !== saved.alt) patch.defaultAlt = draft.alt;
		if (draft.caption !== saved.caption) patch.defaultCaption = draft.caption;
		setSaving(true);
		setError(null);
		try {
			await onSave(patch);
		} catch (failure) {
			setError(errorText(site, failure, t("panel.saveFailed")));
		} finally {
			setSaving(false);
		}
	};

	const alt: SlotRequest = {
		slot: "media",
		target: "defaultAlt",
		scope: media.id,
		disabled: media.status !== "ready" || !isImage,
		getContext: () => ({ mediaId: media.id, filename: media.filename, current: draft.alt }),
		apply: (value) => update({ alt: value }),
	};

	const usages = mediaUsages(media, placeNamer(site, t));
	const ext = extensionOf(media.filename);
	// The ⋯ holds what changes the file: replace, the ID (a picture's), and the trash. The address is in the body, under the picture.
	const menu: MenuAction[] = [
		{ kind: "item", label: t("panel.replace"), icon: FolderMoveTo, onSelect: onReplace },
		...(isImage
			? ([
					{
						kind: "item",
						label: t("panel.copyId"),
						icon: Copy,
						onSelect: () => void copyText(media.id, t("panel.copiedId"), tc("copyFailed")),
					},
				] satisfies MenuAction[])
			: []),
		{ kind: "separator" },
		{ kind: "item", label: tc("lifecycle.trash"), icon: TrashCan, destructive: true, onSelect: onTrash },
	];
	const menuNames = menu.flatMap((item) => (item.kind === "item" ? [item.label] : [])).join(", ");

	return (
		<SidePanel
			title={media.filename}
			onClose={onClose}
			bleed={false}
			actions={<MoreActionsButton actions={menu} label={t("panel.more", { items: menuNames })} />}
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
			footer={
				<Stack direction="row" gap={16} grow justify={isImage ? "end" : "between"} align="center">
					{!isImage && (
						<Inline gap={16}>
							<TextButton onClick={onReplace}>{t("panel.replace")}</TextButton>
							<TextButton onClick={onTrash}>{tc("lifecycle.trash")}</TextButton>
						</Inline>
					)}
					<Button type="submit" disabled={!dirty || problem !== null || saving}>
						{tc("save")}
					</Button>
				</Stack>
			}
		>
			{isImage ? (
				<Image src={media.publicUrl} alt="" ratio="photo" fit="contain" radius="md" />
			) : (
				<FilePreview ext={ext.toUpperCase()} framed />
			)}
			{media.publicUrl && (
				<Inline gap={16}>
					<TextButton
						variant="underline"
						onClick={() => void copyText(media.publicUrl as string, t("panel.copiedUrl"), tc("copyFailed"))}
					>
						{t("panel.copyUrl")}
					</TextButton>
					<TextButton variant="underline" href={media.publicUrl} target="_blank" rel="noopener noreferrer">
						{t("panel.openTab")}
					</TextButton>
				</Inline>
			)}

			<FormField data-invalid={nameShown || undefined}>
				<FormFieldLabel htmlFor={nameId}>{t("panel.filename")}</FormFieldLabel>
				<Inline gap={8} align="baseline">
					<Input
						id={nameId}
						mono
						value={draft.stem}
						disabled={saving || media.status !== "ready"}
						aria-invalid={nameShown || undefined}
						aria-describedby={nameShown ? nameErrorId : undefined}
						onChange={(event) => update({ stem: event.target.value })}
					/>
					{extension && (
						<Box shrink={false}>
							<Text as="span" tone="subtle" title={t("panel.extensionKept")}>
								{extension}
							</Text>
						</Box>
					)}
				</Inline>
				{nameShown && (
					<FormFieldError id={nameErrorId}>
						{problem === "empty" ? t("panel.nameEmpty") : t("panel.nameInvalid")}
					</FormFieldError>
				)}
			</FormField>

			<FormField>
				<FormFieldLabel>{t("panel.folder")}</FormFieldLabel>
				<Select
					value={draft.folderId ?? "root"}
					items={folderItems}
					disabled={saving}
					onValueChange={(value) => update({ folderId: value === "root" ? null : value })}
				>
					<SelectTrigger width="full" aria-label={t("panel.folder")}>
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
			</FormField>

			{isImage && (
				<>
					<SlotScope key={`alt-${media.id}`} request={alt}>
						{({ trigger, panel }) => (
							<FormField>
								<Inline gap={8} justify="between">
									<FormFieldLabel htmlFor={altId}>{t("panel.alt")}</FormFieldLabel>
									{trigger}
								</Inline>
								<Textarea
									id={altId}
									rows={2}
									value={draft.alt}
									disabled={saving}
									onChange={(event) => update({ alt: event.target.value })}
								/>
								{panel}
							</FormField>
						)}
					</SlotScope>
					<FormField>
						<FormFieldLabel htmlFor={captionId}>{t("panel.caption")}</FormFieldLabel>
						<Input
							id={captionId}
							value={draft.caption}
							placeholder={t("panel.captionEmpty")}
							disabled={saving}
							onChange={(event) => update({ caption: event.target.value })}
						/>
					</FormField>
				</>
			)}

			<DescriptionList>
				<DescriptionItem label={t("panel.kind")}>{kindName(t, media, isImage)}</DescriptionItem>
				<DescriptionItem label={t("panel.size")}>
					{isImage && media.original ? (
						<Numbers>
							{t("panel.web", {
								width: media.width ?? 0,
								height: media.height ?? 0,
								size: formatFileSize(media.byteSize ?? 0),
							})}
							<br />
							{t("panel.original", {
								width: media.original.width ?? 0,
								height: media.original.height ?? 0,
								size: formatFileSize(media.original.byteSize ?? 0),
							})}
						</Numbers>
					) : isImage ? (
						<Numbers>{`${media.width}×${media.height} · ${formatFileSize(media.byteSize ?? 0)}`}</Numbers>
					) : (
						<Numbers>{formatFileSize(media.byteSize ?? 0)}</Numbers>
					)}
				</DescriptionItem>
				<DescriptionItem label={t("panel.uploadedAt")}>
					<Numbers>
						{formatDateTime(site, media.createdAt, { year: "numeric", month: "2-digit", day: "2-digit" }).replace(
							/\.$/,
							"",
						)}
					</Numbers>
				</DescriptionItem>
			</DescriptionList>

			<Stack gap={4}>
				<FormFieldLabel>
					{usages.length > 0 ? t("panel.usedIn", { count: usageCount(media) }) : t("panel.usedInNone")}
				</FormFieldLabel>
				{usages.length === 0 ? (
					<Text as="span" variant="note" tone="faint">
						{t("panel.none")}
					</Text>
				) : (
					<Stack as="ul" gap={0}>
						{usages.map((usage) => (
							<li key={usage.entryId}>
								<Inline gap={8} justify="between" paddingY={8}>
									<TextButton variant="ink" href={withBasePath(entryHref(site, usage.collection, usage.entryId))}>
										{usage.title || tc("untitled")}
									</TextButton>
									{usage.places.length > 0 && (
										<Text variant="micro" tone="subtle">
											{usage.places.join(" · ")}
										</Text>
									)}
								</Inline>
							</li>
						))}
					</Stack>
				)}
			</Stack>
			{error && <FormFieldError>{error}</FormFieldError>}
		</SidePanel>
	);
}
