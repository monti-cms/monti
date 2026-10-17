"use client";

// Small header pieces of the entry editor: icon actions, toggles and the save status indicator.

import { useTranslator } from "@monti-cms/core/site";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils/cn";
import type { TranslatorFor } from "../../translator";
import { buttonVariants } from "../../ui/button";
import { IconButton } from "../../ui/icon-button";
import { StatusIndicator, type StatusTone } from "../../ui/status-indicator";
import { Toggle } from "../../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import type { SaveStatus } from "./entry-editor-types";
import { entriesMessages } from "./messages";

export function ToolbarAction({
	label,
	icon: Icon,
	href,
	onClick,
	disabled = false,
}: {
	label: string;
	icon: LucideIcon;
	href?: string;
	onClick?: () => void;
	disabled?: boolean;
}) {
	const className = "size-8 shrink-0 text-monti-muted-foreground";
	const icon = <Icon aria-hidden className="size-4" />;
	if (!href || disabled) {
		return (
			<IconButton label={label} side="bottom" disabled={disabled} className={className} onClick={onClick}>
				{icon}
			</IconButton>
		);
	}
	// A link stays a link (open in new tab, copy URL). Its name and tooltip match the icon buttons.
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<a
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={label}
						className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), className)}
					>
						{icon}
					</a>
				}
			/>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

/** Toggle button at the end of the editor toolbar (source pane, MDX source). Name and tooltip are the same. */
export function ToolbarToggle({
	label,
	text,
	icon: Icon,
	pressed,
	disabled,
	onPressedChange,
}: {
	label: string;
	/** Text next to the icon. If absent, only the icon shows (the name is the tooltip). */
	text?: string;
	icon: LucideIcon;
	pressed: boolean;
	disabled?: boolean;
	onPressedChange: (pressed: boolean) => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Toggle
						size="sm"
						aria-label={label}
						pressed={pressed}
						disabled={disabled}
						onPressedChange={onPressedChange}
						className="gap-1.5 text-monti-muted-foreground aria-pressed:text-monti-foreground"
					/>
				}
			>
				<Icon aria-hidden className="size-4" />
				{text}
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

/** Name of each save status. */
const saveStatusLabels = (te: TranslatorFor<typeof entriesMessages>): Record<SaveStatus, string> => ({
	new: te("save.new"),
	saved: te("save.saved"),
	dirty: te("save.dirty"),
	saving: te("save.saving"),
	"local-only": te("save.local-only"),
	failed: te("save.failed"),
	conflict: te("save.conflict"),
	"session-expired": te("save.session-expired"),
});

/** Tone of the save status dot. When adding a status, its tone must be chosen here. */
const SAVE_STATUS_TONE: Record<SaveStatus, StatusTone> = {
	new: "neutral",
	saved: "success",
	dirty: "neutral",
	saving: "warning",
	"local-only": "neutral",
	failed: "destructive",
	conflict: "destructive",
	"session-expired": "destructive",
};

/** Save status in the header. On narrow screens only the dot shows, and the name is announced to screen readers. */
export function SaveStatusIndicator({ status, backupAvailable }: { status: SaveStatus; backupAvailable: boolean }) {
	const t = useTranslator(entryEditorShellMessages);
	const te = useTranslator(entriesMessages);
	const label = `${saveStatusLabels(te)[status]}${backupAvailable ? "" : t("backupUnavailable")}`;
	return (
		<output
			aria-live="polite"
			aria-label={label}
			className="mr-1 flex items-center gap-1.5 text-monti-muted-foreground text-xs"
		>
			<StatusIndicator size="sm" tone={SAVE_STATUS_TONE[status]} pulse={status === "saving"} />
			<span className="hidden lg:inline">{label}</span>
		</output>
	);
}
