"use client";

// The header of the entry editor screen: the collection as a way back, the address and status, save, preview and publish, and the properties and "more" menus.

import {
	Archive,
	ChevronLeft,
	Contrast,
	Copy,
	Download,
	OverflowMenuHorizontal,
	RightPanelOpen,
	TrashCan,
} from "@carbon/icons-react";
import { useSite, useTranslator, withBasePath } from "@monti-cms/core/site";
import {
	Box,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	EntryStatus,
	IconButton,
	Inline,
	Separator,
	SplitButton,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useTheme } from "next-themes";
import { useState } from "react";
import type { EditorMenuItem } from "../../admin-components";
import { EditorMenuRows } from "../../editor/editor-menu";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink as Link } from "../../router";
import { ExportDialog } from "../export/export-dialog";
import { exportMessages } from "../export/messages";
import { deleteMessages } from "../shared/delete.messages";
import { entryPath } from "../shared/entry-address";
import { entryStatusKind, hasUnpublishedChanges, statusName } from "../shared/entry-status";
import { collectionNoun } from "../shared/noun.messages";
import { SidePanelToggle } from "../shared/side-panel-slot";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import type { EntryEditor } from "./entry-editor-types";
import { isTranslationEntry } from "./entry-form";
import { shortDate } from "./entry-stamps";
import { lifecycleLabel } from "./lifecycle-confirm";
import type { EntryLifecycleCommands } from "./use-entry-lifecycle-commands";

interface EntryEditorHeaderProps {
	editor: EntryEditor;
	commands: EntryLifecycleCommands;
	isInspectorOpen: boolean;
	onToggleInspector: () => void;
	/** Rows of the ⋯ menu's document tools: the screen's view switches and what editor extensions add. */
	menuItems?: readonly EditorMenuItem[];
}

export function EntryEditorHeader({
	editor,
	commands,
	isInspectorOpen,
	onToggleInspector,
	menuItems,
}: EntryEditorHeaderProps) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	const tc = useTranslator(commonMessages);
	const td = useTranslator(deleteMessages);
	const tx = useTranslator(exportMessages);
	const [isExporting, setIsExporting] = useState(false);
	const { resolvedTheme, setTheme } = useTheme();
	const { entry, collection, busy } = editor;
	const { isPublishing, isSubmitting } = commands;
	const {
		handlePreview,
		handlePublish,
		runLifecycle,
		confirmLifecycle,
		trashEntry,
		confirmPermanentDelete,
		handleDuplicate,
	} = commands;
	const isTrashed = entry?.status === "trashed";
	const hasPublishDate = Boolean(entry?.publishedAt);
	const unpublished = hasUnpublishedChanges(site, entry, editor.hasUnsavedChanges);
	// A translation can share a slug with the original, so the language is passed along.
	const previewPath = entry ? site.previewHref(collection, entry.workingSlug, entry.locale) : null;
	// This is a URL opened in a new tab, so Next does not prepend `basePath`.
	const previewHref = previewPath === null ? null : withBasePath(previewPath);
	// When the preview cannot work, the button stays and the reason is written beside it.
	const previewBlocker = previewHref === null ? site.previewBlocker(collection, entry?.workingSlug) : null;
	// The address as the public site shows it; an entry without a slug yet shows dots where it will be.
	const path = entryPath(site, {
		collection,
		locale: entry?.locale,
		workingSlug: entry?.workingSlug ?? null,
		publishedSlug: null,
	});

	return (
		<Inline
			as="header"
			wrap
			justify="between"
			gap={12}
			shrink={false}
			border="bottom"
			background="page"
			minHeight="header"
			paddingX={12}
		>
			<Inline gap={12} minWidth={0} paddingX={12}>
				<TextButton variant="quiet" render={<Link href={site.adminHref(`?collection=${collection}`)} />}>
					<ChevronLeft aria-hidden />
					{collectionNoun(site, collection) || t("backToList")}
				</TextButton>
				{path && (
					<Box hideBelow="sm" minWidth={0}>
						<Text variant="meta" tone="faint" truncate>
							{path}
						</Text>
					</Box>
				)}
				{entry && (
					<EntryStatus data-testid="entry-status-chip" status={entryStatusKind(entry.status, unpublished)}>
						{statusName(site, entry.status, unpublished)}
					</EntryStatus>
				)}
			</Inline>

			<Inline gap={12} justify="end">
				{isTrashed ? (
					// A trashed entry is read-only: the head holds only what can be done with it, deleting it for good or bringing it back.
					<TextButton variant="danger" onClick={confirmPermanentDelete}>
						{tc("lifecycle.deletePermanently")}
					</TextButton>
				) : (
					<TextButton
						type="button"
						disabled={busy !== null || isSubmitting}
						onClick={() => void commands.handleSaveNow()}
					>
						{editor.saveStatus === "saving" ? tc("saving") : tc("save")}
					</TextButton>
				)}
				{!isTrashed &&
					(previewHref && !editor.hasUnsavedChanges ? (
						// A link stays a link (open in new tab, copy URL).
						<Button
							variant="secondary"
							nativeButton={false}
							// A link stays a link: Button gives a non-<button> role="button", so the role is set back (the content is the child below).
							// biome-ignore lint/a11y/useAnchorContent: the children are passed to the rendered element by Button
							// biome-ignore lint/a11y/useSemanticElements: the element is an <a>; the role overrides the one Button adds
							// biome-ignore lint/a11y/noRedundantRoles: Button adds role="button" to a non-<button>, so the link role is needed
							render={<a role="link" href={previewHref} target="_blank" rel="noopener noreferrer" />}
						>
							{t("preview")}
						</Button>
					) : previewHref ? (
						<Button type="button" variant="secondary" onClick={() => void handlePreview(previewHref)}>
							{t("preview")}
						</Button>
					) : (
						<>
							<Box hideBelow="lg">
								<Text id="cms-preview-reason" variant="caption" tone="subtle">
									{t(`preview.${previewBlocker ?? "no-slug"}`)}
								</Text>
							</Box>
							{/* `aria-disabled` instead of `disabled`: the button keeps its place in the tab order, and the reason is its description. */}
							<Button type="button" variant="secondary" aria-disabled aria-describedby="cms-preview-reason">
								{t("preview")}
							</Button>
						</>
					))}
				{/* Single-step transitions (publish, unarchive, restore) happen right away without asking. */}
				{isTrashed ? (
					<Button type="button" disabled={isSubmitting} onClick={() => void runLifecycle("restore")}>
						{busy === "status" ? t("restoring") : lifecycleLabel(site).restore}
					</Button>
				) : entry?.status === "archived" ? (
					<Button type="button" disabled={isSubmitting} onClick={() => void runLifecycle("unarchive")}>
						{busy === "status" ? t("unarchiving") : lifecycleLabel(site).unarchive}
					</Button>
				) : !hasPublishDate ? (
					<Button id="cms-publish" type="button" disabled={isSubmitting} onClick={() => void handlePublish()}>
						{isPublishing ? t("publishing") : t("publish")}
					</Button>
				) : (
					// For a post that has a publish date, publish and "republish with today's date" sit side by side as one split button. With nothing
					// changed since it was published, the pill reads "published" and is dimmed.
					<SplitButton
						id="cms-publish"
						disabled={isSubmitting || (entry?.status === "published" && !unpublished)}
						onClick={() => void handlePublish()}
						menuLabel={t("publishOptions")}
						menu={
							<>
								<DropdownMenuItem
									caption={t("keepDateCaption", { date: shortDate(site, entry?.publishedAt as string) })}
									onClick={() => void handlePublish()}
								>
									{t("keepDate")}
								</DropdownMenuItem>
								<DropdownMenuItem
									caption={t("republishCaption", { date: shortDate(site, new Date()) })}
									onClick={() => void handlePublish({ resetPublishedAt: true })}
								>
									{t("republish")}
								</DropdownMenuItem>
							</>
						}
					>
						{isPublishing
							? t("publishing")
							: entry?.status === "published" && !unpublished
								? t("publishedState")
								: t("publish")}
					</SplitButton>
				)}
				<IconButton label={t("properties")} side="bottom" pressed={isInspectorOpen} onClick={onToggleInspector}>
					<RightPanelOpen aria-hidden />
				</IconButton>
				<DropdownMenu>
					<IconButton label={t("more")} side="bottom" trigger={(button) => <DropdownMenuTrigger render={button} />}>
						<OverflowMenuHorizontal aria-hidden />
					</IconButton>
					<DropdownMenuContent align="end">
						{/* Save with the header save button and ⌘S. Not repeated in the menu. */}
						{entry && !isTrashed && (
							<>
								{/* The store refuses to duplicate a translation, so only a source can be duplicated. */}
								{!isTranslationEntry(entry) && (
									<DropdownMenuItem onClick={() => void handleDuplicate()}>
										<Copy aria-hidden />
										{tc("lifecycle.duplicate")}
									</DropdownMenuItem>
								)}
								{(entry.status === "draft" || entry.status === "published") && (
									<DropdownMenuItem onClick={() => confirmLifecycle("archive")}>
										<Archive aria-hidden />
										{lifecycleLabel(site).archive}
									</DropdownMenuItem>
								)}
							</>
						)}
						{entry && (
							<DropdownMenuItem onClick={() => setIsExporting(true)}>
								<Download aria-hidden />
								{tx("menu.exportEntry")}
							</DropdownMenuItem>
						)}
						{/* The document tools: what extensions add (MDX view, Translate all), the body width and the theme. */}
						{entry && <DropdownMenuSeparator />}
						<EditorMenuRows items={menuItems} />
						<DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
							<Contrast aria-hidden />
							{t("toggleTheme")}
						</DropdownMenuItem>
						{entry && !isTrashed && (
							<>
								<DropdownMenuSeparator />
								{isTranslationEntry(entry) ? (
									// Only this translation goes; the menu says which language stays.
									<DropdownMenuItem
										variant="danger"
										caption={td("translation.caption", {
											language: site.localeLabel(
												entry.translations?.find((member) => member.isSource)?.locale ??
													entry.source?.locale ??
													site.DEFAULT_LOCALE,
											),
										})}
										onClick={() => void trashEntry()}
									>
										{td("translation.trash")}
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem variant="danger" onClick={() => void trashEntry()}>
										<TrashCan aria-hidden />
										{lifecycleLabel(site).trash}
									</DropdownMenuItem>
								)}
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
				<Inline height="control-sm" paddingX={4}>
					<Separator orientation="vertical" aria-hidden />
				</Inline>
				<SidePanelToggle />
			</Inline>
			{entry && (
				<ExportDialog
					open={isExporting}
					onOpenChange={setIsExporting}
					kind="entry"
					ids={[entry.id]}
					noun={collectionNoun(site, collection)}
					unsaved={editor.hasUnsavedChanges}
				/>
			)}
		</Inline>
	);
}
