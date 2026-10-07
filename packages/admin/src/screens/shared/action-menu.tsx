"use client";

import { useTranslator } from "@monti-cms/core/client";
import { type LucideIcon, MoreHorizontal } from "lucide-react";
import { cloneElement, type ReactElement } from "react";
import { useHydrated } from "../../lib/hooks/use-hydrated";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "../../ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { IconButton } from "../../ui/icon-button";
import { sharedMessages } from "./messages";

/**
 * Menu definition shared by the right-click menu and the `⋯` button. Rendering the same list in two places
 * lets users who don't know right-click or can't use it (touch) do the same actions.
 */
export type MenuAction =
	| {
			kind: "item";
			label: string;
			/** Icon before the item. Every menu item has an icon. */
			icon?: LucideIcon;
			onSelect: () => void;
			destructive?: boolean;
			disabled?: boolean;
			/** Shortcut hint shown on screen. The caller handles the actual key handling. */
			shortcut?: string;
	  }
	| { kind: "sub"; label: string; icon?: LucideIcon; items: MenuAction[]; emptyLabel?: string; disabled?: boolean }
	| { kind: "label"; label: string }
	| { kind: "separator" };

/** Removes leading, trailing or consecutive separators (after dropping conditional items). */
function tidy(actions: MenuAction[]): MenuAction[] {
	const out: MenuAction[] = [];
	for (const action of actions) {
		if (action.kind === "separator" && (out.length === 0 || out.at(-1)?.kind === "separator")) continue;
		out.push(action);
	}
	while (out.at(-1)?.kind === "separator") out.pop();
	return out;
}

function ContextItems({ actions }: { actions: MenuAction[] }) {
	const t = useTranslator(sharedMessages);
	return tidy(actions).map((action, index) => {
		const key = `${action.kind}-${"label" in action ? action.label : index}-${index}`;
		switch (action.kind) {
			case "separator":
				return <ContextMenuSeparator key={key} />;
			case "label":
				return (
					<ContextMenuGroup key={key}>
						<ContextMenuLabel>{action.label}</ContextMenuLabel>
					</ContextMenuGroup>
				);
			case "sub":
				return (
					<ContextMenuSub key={key}>
						<ContextMenuSubTrigger disabled={action.disabled}>
							{action.icon && <action.icon aria-hidden />}
							{action.label}
						</ContextMenuSubTrigger>
						<ContextMenuSubContent className="max-h-80 overflow-y-auto">
							{action.items.length === 0 ? (
								<ContextMenuItem disabled>{action.emptyLabel ?? t("menu.empty")}</ContextMenuItem>
							) : (
								<ContextItems actions={action.items} />
							)}
						</ContextMenuSubContent>
					</ContextMenuSub>
				);
			case "item":
				return (
					<ContextMenuItem
						key={key}
						variant={action.destructive ? "destructive" : "default"}
						disabled={action.disabled}
						onClick={action.onSelect}
					>
						{action.icon && <action.icon aria-hidden />}
						{action.label}
						{action.shortcut && <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>}
					</ContextMenuItem>
				);
			default:
				return null;
		}
	});
}

function DropdownItems({ actions }: { actions: MenuAction[] }) {
	const t = useTranslator(sharedMessages);
	return tidy(actions).map((action, index) => {
		const key = `${action.kind}-${"label" in action ? action.label : index}-${index}`;
		switch (action.kind) {
			case "separator":
				return <DropdownMenuSeparator key={key} />;
			case "label":
				return (
					<DropdownMenuGroup key={key}>
						<DropdownMenuLabel>{action.label}</DropdownMenuLabel>
					</DropdownMenuGroup>
				);
			case "sub":
				return (
					<DropdownMenuSub key={key}>
						<DropdownMenuSubTrigger disabled={action.disabled}>
							{action.icon && <action.icon aria-hidden />}
							{action.label}
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="max-h-80 overflow-y-auto">
							{action.items.length === 0 ? (
								<DropdownMenuItem disabled>{action.emptyLabel ?? t("menu.empty")}</DropdownMenuItem>
							) : (
								<DropdownItems actions={action.items} />
							)}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				);
			case "item":
				return (
					<DropdownMenuItem
						key={key}
						variant={action.destructive ? "destructive" : "default"}
						disabled={action.disabled}
						onClick={action.onSelect}
					>
						{action.icon && <action.icon aria-hidden />}
						{action.label}
						{action.shortcut && <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>}
					</DropdownMenuItem>
				);
			default:
				return null;
		}
	});
}

/**
 * Right-clicking `trigger` (or Shift+F10 / the menu key) opens the menu. `trigger` is the element to actually render
 * (e.g. `<TableRow />`). If the menu is empty, right-click is not intercepted.
 */
export function ActionContextMenu({
	actions,
	trigger,
	children,
	onOpenChange,
}: {
	actions: MenuAction[];
	trigger: ReactElement;
	children?: React.ReactNode;
	onOpenChange?: (open: boolean) => void;
}) {
	const items = tidy(actions);
	const hydrated = useHydrated();
	// Rendering Base UI ContextMenu on the server makes the auto ID (useId) of following elements differ between server and browser
	// (hydration mismatch). Right-click works only after hydration, so attach the menu then.
	if (!hydrated) return cloneElement(trigger, undefined, children);
	return (
		<ContextMenu onOpenChange={onOpenChange} disabled={items.length === 0}>
			<ContextMenuTrigger render={trigger} className="select-auto">
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent className="min-w-48">
				<ContextItems actions={items} />
			</ContextMenuContent>
		</ContextMenu>
	);
}

/** Always-visible `⋯` button. Opens the same items as the right-click menu. */
export function MoreActionsButton({
	actions,
	label,
	className,
}: {
	actions: MenuAction[];
	/** Button name and tooltip (e.g. `'알고리즘' 폴더 작업`). */
	label: string;
	className?: string;
}) {
	const items = tidy(actions);
	if (items.length === 0) return null;
	return (
		<DropdownMenu>
			<IconButton label={label} className={className} trigger={(button) => <DropdownMenuTrigger render={button} />}>
				<MoreHorizontal aria-hidden />
			</IconButton>
			<DropdownMenuContent align="end" className="min-w-48">
				<DropdownItems actions={items} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
