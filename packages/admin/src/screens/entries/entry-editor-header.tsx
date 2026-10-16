"use client";

// The header of the entry editor screen: back link, status, save status, save/preview/publish actions and the properties and "more" menus.

import { useSite, useTranslator, withBasePath } from "@monti-cms/core/site";
import {
	Archive,
	CalendarSync,
	ChevronDown,
	ChevronLeft,
	Copy,
	Eye,
	MoreHorizontal,
	PanelRight,
	Save,
	SunMoon,
	Trash,
	Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
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
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import { SaveStatusIndicator, ToolbarAction } from "./entry-editor-toolbar";
import type { EntryEditor } from "./entry-editor-types";
import { isTranslationEntry } from "./entry-form";
import { lifecycleLabel } from "./lifecycle-confirm";
import { entriesMessages } from "./messages";
import type { EntryLifecycleCommands } from "./use-entry-lifecycle-commands";

interface EntryEditorHeaderProps {
	editor: EntryEditor;
	commands: EntryLifecycleCommands;
	statusLabel: string;
	isInspectorOpen: boolean;
	onToggleInspector: () => void;
}

export function EntryEditorHeader({
	editor,
	commands,
	statusLabel,
	isInspectorOpen,
	onToggleInspector,
}: EntryEditorHeaderProps) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	const te = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	const { resolvedTheme, setTheme } = useTheme();
	const { entry, collection, busy, saveStatus } = editor;
	const isReadOnly = editor.readOnly;
	const { isPublishing, isSubmitting } = commands;
	const {
		handleSaveNow,
		handlePreview,
		handlePublish,
		runLifecycle,
		confirmLifecycle,
		confirmPermanentDelete,
		handleDuplicate,
	} = commands;
	const isTrashed = entry?.status === "trashed";
	const canResetPublishedAt = Boolean(entry?.publishedAt);
	const canRetry = ["failed", "local-only", "session-expired"].includes(saveStatus);
	// A translation can share a slug with the original, so the language is passed along.
	const previewPath = entry ? site.previewHref(collection, entry.workingSlug, entry.locale) : null;
	// This is a URL opened in a new tab, so Next does not prepend `basePath`.
	const previewHref = previewPath === null ? null : withBasePath(previewPath);

	return (
		<header className="z-20 flex min-h-13 shrink-0 flex-wrap items-center justify-between gap-1 border-b bg-cms-background/95 px-3 py-2 backdrop-blur sm:flex-nowrap lg:px-4">
			<div className="flex min-w-0 items-center gap-2 text-[13px]">
				<Tooltip>
					<TooltipTrigger
						render={
							<Link
								href={site.adminHref(`?collection=${collection}`)}
								aria-label={t("backToList")}
								className={cn(
									buttonVariants({ variant: "ghost", size: "icon-sm" }),
									"size-8 text-cms-muted-foreground",
								)}
							>
								<ChevronLeft aria-hidden className="size-4" />
							</Link>
						}
					/>
					<TooltipContent side="bottom">{t("backToList")}</TooltipContent>
				</Tooltip>
				<span className="hidden rounded bg-cms-muted px-1.5 py-0.5 text-cms-muted-foreground text-xs sm:inline-flex">
					{statusLabel}
				</span>
			</div>

			<div className="flex w-full items-center justify-end gap-1 whitespace-nowrap sm:w-auto">
				<SaveStatusIndicator status={saveStatus} backupAvailable={editor.recoveryCopyAvailable} />
				{canRetry && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="text-cms-muted-foreground"
						onClick={() => void editor.retry()}
					>
						{te("retry")}
					</Button>
				)}
				{saveStatus === "session-expired" && (
					<a
						href={site.adminHref("/login")}
						target="_blank"
						rel="noreferrer"
						className={buttonVariants({ variant: "link", size: "xs" })}
					>
						{t("signInNewWindow")}
					</a>
				)}

				<ToolbarAction
					label={tc("save")}
					icon={Save}
					disabled={isReadOnly || isSubmitting || saveStatus === "saving"}
					onClick={() => void handleSaveNow()}
				/>
				{previewHref && (
					<ToolbarAction
						label={t("preview")}
						icon={Eye}
						href={editor.hasUnsavedChanges ? undefined : previewHref}
						onClick={() => void handlePreview(previewHref)}
					/>
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
					<div className="ml-1 flex h-8 items-center overflow-hidden rounded-[min(var(--radius-md),10px)] bg-cms-primary text-cms-primary-foreground">
						<Button
							id="cms-publish"
							type="button"
							size="sm"
							className="h-full rounded-none bg-transparent pr-2 pl-3 hover:bg-cms-primary-foreground/10"
							disabled={isSubmitting}
							onClick={() => void handlePublish()}
						>
							{isPublishing ? t("publishing") : tc("lifecycle.publish")}
						</Button>
						<span aria-hidden className="h-4 w-px bg-cms-primary-foreground/30" />
						<DropdownMenu>
							<IconButton
								label={t("publishOptions")}
								side="bottom"
								variant="default"
								disabled={isSubmitting}
								className="h-full w-7 rounded-none bg-transparent hover:bg-cms-primary-foreground/10 aria-expanded:bg-cms-primary-foreground/10"
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
				<span aria-hidden className="mx-1 h-4 w-px bg-cms-border" />
				<IconButton
					label={t("properties")}
					side="bottom"
					pressed={isInspectorOpen}
					className="size-8 text-cms-muted-foreground"
					onClick={onToggleInspector}
				>
					<PanelRight aria-hidden className="size-4" />
				</IconButton>
				<DropdownMenu>
					<IconButton
						label={t("more")}
						side="bottom"
						className="size-8 text-cms-muted-foreground"
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
		</header>
	);
}
