"use client";

// The header of the entry editor screen: back link, the slug, the preview and publish actions and the properties and "more" menus. The save state lives in the status bar.

import { useSite, useTranslator, withBasePath } from "@monti-cms/core/site";
import {
	Box,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	IconButton,
	Inline,
	Separator,
	StatusIndicator,
	Text,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@monti-cms/ui";
import {
	Archive,
	CalendarSync,
	ChevronDown,
	ChevronLeft,
	Copy,
	Download,
	Eye,
	MoreHorizontal,
	PanelRight,
	SunMoon,
	Trash,
	Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink as Link } from "../../router";
import { ExportDialog } from "../export/export-dialog";
import { exportMessages } from "../export/messages";
import { statusLabels } from "../shared/entry-status";
import { entryStatusMarker } from "../shared/entry-status-marker";
import { collectionNoun } from "../shared/noun.messages";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import type { EntryEditor } from "./entry-editor-types";
import { isTranslationEntry } from "./entry-form";
import { lifecycleLabel } from "./lifecycle-confirm";
import type { EntryLifecycleCommands } from "./use-entry-lifecycle-commands";

interface EntryEditorHeaderProps {
	editor: EntryEditor;
	commands: EntryLifecycleCommands;
	isInspectorOpen: boolean;
	onToggleInspector: () => void;
}

export function EntryEditorHeader({ editor, commands, isInspectorOpen, onToggleInspector }: EntryEditorHeaderProps) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	const tc = useTranslator(commonMessages);
	const tx = useTranslator(exportMessages);
	const [isExporting, setIsExporting] = useState(false);
	const { resolvedTheme, setTheme } = useTheme();
	const { entry, collection, busy } = editor;
	const { isPublishing, isSubmitting } = commands;
	const { handlePreview, handlePublish, runLifecycle, confirmLifecycle, confirmPermanentDelete, handleDuplicate } =
		commands;
	const isTrashed = entry?.status === "trashed";
	const canResetPublishedAt = Boolean(entry?.publishedAt);
	// A translation can share a slug with the original, so the language is passed along.
	const previewPath = entry ? site.previewHref(collection, entry.workingSlug, entry.locale) : null;
	// This is a URL opened in a new tab, so Next does not prepend `basePath`.
	const previewHref = previewPath === null ? null : withBasePath(previewPath);
	// When the preview cannot work, the button stays and says why instead of vanishing.
	const previewBlocker = previewHref === null ? site.previewBlocker(collection, entry?.workingSlug) : null;

	return (
		<Inline
			as="header"
			wrap
			justify="between"
			gap="tight"
			shrink={false}
			border="bottom"
			background="page"
			paddingX="comfortable"
			paddingY="condensed"
		>
			<Inline gap="condensed" minWidth={0}>
				<Tooltip>
					<TooltipTrigger
						render={
							// A link stays a link: Button would give a non-<button> role="button", so the role is kept.
							<Button
								variant="ghost"
								size="icon-sm"
								nativeButton={false}
								aria-label={t("backToList")}
								render={<Link role="link" href={site.adminHref(`?collection=${collection}`)} />}
							>
								<ChevronLeft aria-hidden />
							</Button>
						}
					/>
					<TooltipContent side="bottom">{t("backToList")}</TooltipContent>
				</Tooltip>
				{entry?.workingSlug && (
					<Box hideBelow="sm" minWidth={0}>
						<Text variant="caption" tone="muted" mono truncate>
							{entry.workingSlug}
						</Text>
					</Box>
				)}
				{entry && (
					<StatusIndicator
						data-testid="entry-status-chip"
						{...entryStatusMarker(entry.status)}
						label={statusLabels(site)[entry.status]}
					/>
				)}
			</Inline>

			<Inline gap="tight" justify="end">
				{/* There is no server autosave, so unsaved changes get a visible save button (⌘S does the same); the status bar says the rest. */}
				{editor.hasUnsavedChanges && !isTrashed && (
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={busy !== null || isSubmitting}
									onClick={() => void commands.handleSaveNow()}
								>
									{editor.saveStatus === "saving" ? tc("saving") : tc("save")}
								</Button>
							}
						/>
						<TooltipContent side="bottom">⌘S</TooltipContent>
					</Tooltip>
				)}
				{previewHref && !editor.hasUnsavedChanges ? (
					// A link stays a link (open in new tab, copy URL).
					<Button
						variant="outline"
						size="sm"
						nativeButton={false}
						// A link stays a link: Button gives a non-<button> role="button", so the role is set back (the content is the child below).
						// biome-ignore lint/a11y/useAnchorContent: the children are passed to the rendered element by Button
						// biome-ignore lint/a11y/useSemanticElements: the element is an <a>; the role overrides the one Button adds
						// biome-ignore lint/a11y/noRedundantRoles: Button adds role="button" to a non-<button>, so the link role is needed
						render={<a role="link" href={previewHref} target="_blank" rel="noopener noreferrer" />}
					>
						<Eye aria-hidden />
						{t("preview")}
					</Button>
				) : previewHref ? (
					<Button type="button" variant="outline" size="sm" onClick={() => void handlePreview(previewHref)}>
						<Eye aria-hidden />
						{t("preview")}
					</Button>
				) : (
					<Tooltip>
						{/* `aria-disabled` instead of `disabled`: a disabled button gets no hover or focus, so it could not show the reason. */}
						<TooltipTrigger
							render={
								<Button
									type="button"
									variant="outline"
									size="sm"
									// design-system: needs a dimmed aria-disabled look on Button (it dims on `disabled` only)
									aria-disabled
								>
									<Eye aria-hidden />
									{t("preview")}
								</Button>
							}
						/>
						<TooltipContent side="bottom">{t(`preview.${previewBlocker ?? "no-slug"}`)}</TooltipContent>
					</Tooltip>
				)}
				{/* Single-step transitions (publish, unarchive, restore) happen right away without asking. */}
				{isTrashed ? (
					<Button type="button" size="sm" disabled={isSubmitting} onClick={() => void runLifecycle("restore")}>
						{busy === "status" ? t("restoring") : lifecycleLabel(site).restore}
					</Button>
				) : entry?.status === "archived" ? (
					<Button type="button" size="sm" disabled={isSubmitting} onClick={() => void runLifecycle("unarchive")}>
						{busy === "status" ? t("unarchiving") : lifecycleLabel(site).unarchive}
					</Button>
				) : !canResetPublishedAt ? (
					<Button id="cms-publish" type="button" size="sm" disabled={isSubmitting} onClick={() => void handlePublish()}>
						{isPublishing ? t("publishing") : tc("lifecycle.publish")}
					</Button>
				) : (
					// For an already published post, publish and "republish with today's date" sit side by side as one group.
					<Inline gap="hair">
						<Button
							id="cms-publish"
							type="button"
							size="sm"
							disabled={isSubmitting}
							onClick={() => void handlePublish()}
						>
							{isPublishing ? t("publishing") : tc("lifecycle.publish")}
						</Button>
						<DropdownMenu>
							<IconButton
								label={t("publishOptions")}
								side="bottom"
								variant="default"
								disabled={isSubmitting}
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							>
								<ChevronDown aria-hidden />
							</IconButton>
							<DropdownMenuContent align="end" width="md">
								{/* Keeping the original publish date is the default. Choose it only when re-posting an edited post as new. */}
								{canResetPublishedAt && (
									<DropdownMenuItem onClick={() => void handlePublish({ resetPublishedAt: true })}>
										<CalendarSync aria-hidden />
										{t("republish")}
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</Inline>
				)}
				<Inline height="control-sm" paddingX="tight">
					<Separator orientation="vertical" aria-hidden />
				</Inline>
				<IconButton label={t("properties")} side="bottom" pressed={isInspectorOpen} onClick={onToggleInspector}>
					<PanelRight aria-hidden />
				</IconButton>
				<DropdownMenu>
					<IconButton label={t("more")} side="bottom" trigger={(button) => <DropdownMenuTrigger render={button} />}>
						<MoreHorizontal aria-hidden />
					</IconButton>
					<DropdownMenuContent align="end" width="lg">
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
						{entry && (
							<>
								{!isTrashed && <DropdownMenuSeparator />}
								{isTrashed ? (
									<DropdownMenuItem variant="danger" onClick={confirmPermanentDelete}>
										<Trash aria-hidden />
										{tc("lifecycle.deletePermanently")}
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem variant="danger" onClick={() => confirmLifecycle("trash")}>
										<Trash2 aria-hidden />
										{lifecycleLabel(site).trash}
									</DropdownMenuItem>
								)}
							</>
						)}
						{entry && <DropdownMenuSeparator />}
						<DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
							<SunMoon aria-hidden />
							{t("toggleTheme")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
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
