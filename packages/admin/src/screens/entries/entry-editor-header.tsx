"use client";

// The header of the entry editor screen: back link, the slug, the preview and publish actions and the properties and "more" menus. The save state lives in the status bar.

import { useSite, useTranslator, withBasePath } from "@monti-cms/core/site";
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
import { cn } from "../../lib/utils/cn";
import { AdminLink as Link } from "../../router";
import { Button, buttonVariants } from "../../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { IconButton } from "../../ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { ExportDialog } from "../export/export-dialog";
import { exportMessages } from "../export/messages";
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
		<header className="z-20 flex min-h-13 shrink-0 flex-wrap items-center justify-between gap-1 border-b bg-monti-background/95 px-3 py-2 backdrop-blur sm:flex-nowrap lg:px-4">
			<div className="flex min-w-0 items-center gap-2 text-monti-label">
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								href={site.adminHref(`?collection=${collection}`)}
								aria-label={t("backToList")}
								className={cn(
									buttonVariants({ variant: "ghost", size: "icon-sm" }),
									"size-8 text-monti-muted-foreground",
								)}
							>
								<ChevronLeft aria-hidden className="size-4" />
							</Link>
						}
					/>
					<TooltipContent side="bottom">{t("backToList")}</TooltipContent>
				</Tooltip>
				{entry?.workingSlug && (
					<span className="hidden min-w-0 truncate font-mono text-monti-caption text-monti-muted-foreground sm:block">
						{entry.workingSlug}
					</span>
				)}
			</div>

			<div className="flex w-full items-center justify-end gap-1 whitespace-nowrap sm:w-auto">
				{previewHref && !editor.hasUnsavedChanges ? (
					// A link stays a link (open in new tab, copy URL).
					<a
						href={previewHref}
						target="_blank"
						rel="noopener noreferrer"
						className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
					>
						<Eye aria-hidden className="size-4" />
						{t("preview")}
					</a>
				) : previewHref ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={() => void handlePreview(previewHref)}
					>
						<Eye aria-hidden className="size-4" />
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
									aria-disabled
									className="cursor-not-allowed gap-1.5 opacity-50 hover:bg-transparent"
								>
									<Eye aria-hidden className="size-4" />
									{t("preview")}
								</Button>
							}
						/>
						<TooltipContent side="bottom" className="max-w-64">
							{t(`preview.${previewBlocker ?? "no-slug"}`)}
						</TooltipContent>
					</Tooltip>
				)}
				{/* Single-step transitions (publish, unarchive, restore) happen right away without asking. */}
				{isTrashed ? (
					<Button
						type="button"
						size="sm"
						className="ml-1"
						disabled={isSubmitting}
						onClick={() => void runLifecycle("restore")}
					>
						{busy === "status" ? t("restoring") : lifecycleLabel(site).restore}
					</Button>
				) : entry?.status === "archived" ? (
					<Button
						type="button"
						size="sm"
						className="ml-1"
						disabled={isSubmitting}
						onClick={() => void runLifecycle("unarchive")}
					>
						{busy === "status" ? t("unarchiving") : lifecycleLabel(site).unarchive}
					</Button>
				) : !canResetPublishedAt ? (
					<Button
						id="cms-publish"
						type="button"
						size="sm"
						className="ml-1"
						disabled={isSubmitting}
						onClick={() => void handlePublish()}
					>
						{isPublishing ? t("publishing") : tc("lifecycle.publish")}
					</Button>
				) : (
					// For an already published post, publish and "republish with today's date" are combined into one button.
					// To look like one button, the wrapper paints the background and the two buttons are separated only by a thin line.
					<div className="ml-1 flex h-8 items-center overflow-hidden rounded-md bg-monti-primary text-monti-primary-foreground">
						<Button
							id="cms-publish"
							type="button"
							size="sm"
							className="h-full rounded-none bg-transparent pr-2 pl-3 hover:bg-monti-primary-foreground/10"
							disabled={isSubmitting}
							onClick={() => void handlePublish()}
						>
							{isPublishing ? t("publishing") : tc("lifecycle.publish")}
						</Button>
						<span aria-hidden className="h-4 w-px bg-monti-primary-foreground/30" />
						<DropdownMenu>
							<IconButton
								label={t("publishOptions")}
								side="bottom"
								variant="default"
								disabled={isSubmitting}
								className="h-full w-7 rounded-none bg-transparent hover:bg-monti-primary-foreground/10 aria-expanded:bg-monti-primary-foreground/10"
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							>
								<ChevronDown aria-hidden className="size-3.5" />
							</IconButton>
							<DropdownMenuContent align="end" className="min-w-48">
								{/* Keeping the original publish date is the default. Choose it only when re-posting an edited post as new. */}
								{canResetPublishedAt && (
									<DropdownMenuItem onClick={() => void handlePublish({ resetPublishedAt: true })}>
										<CalendarSync aria-hidden />
										{t("republish")}
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)}
				<span aria-hidden className="mx-1 h-4 w-px bg-monti-border" />
				<IconButton
					label={t("properties")}
					side="bottom"
					pressed={isInspectorOpen}
					className="size-8 text-monti-muted-foreground"
					onClick={onToggleInspector}
				>
					<PanelRight aria-hidden className="size-4" />
				</IconButton>
				<DropdownMenu>
					<IconButton
						label={t("more")}
						side="bottom"
						className="size-8 text-monti-muted-foreground"
						trigger={(button) => <DropdownMenuTrigger render={button} />}
					>
						<MoreHorizontal aria-hidden className="size-4" />
					</IconButton>
					<DropdownMenuContent align="end" className="min-w-56">
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
									<DropdownMenuItem variant="destructive" onClick={confirmPermanentDelete}>
										<Trash aria-hidden />
										{tc("lifecycle.deletePermanently")}
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem variant="destructive" onClick={() => confirmLifecycle("trash")}>
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
			</div>
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
		</header>
	);
}
