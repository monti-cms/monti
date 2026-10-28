"use client";

import { OverflowMenuHorizontal } from "@carbon/icons-react";
import { useTranslator } from "@monti-cms/core/site";
import type { MontiIcon } from "@monti-cms/ui";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	IconButton,
	MenuShortcut,
} from "@monti-cms/ui";
import { cloneElement, type ReactElement } from "react";
import { useHydrated } from "../../lib/hooks/use-hydrated";
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
			icon?: MontiIcon;
			onSelect: () => void;
			destructive?: boolean;
			disabled?: boolean;
			/** Shortcut hint shown on screen. The caller handles the actual key handling. */
			shortcut?: string;
	  }
	| { kind: "sub"; label: string; icon?: MontiIcon; items: MenuAction[]; emptyLabel?: string; disabled?: boolean }
	/** A second level that holds rows of its own (boxes to tick, a search row), given as the menu's rows. */
	| { kind: "choice"; label: string; icon?: MontiIcon; content: React.ReactNode }
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
						<ContextMenuSubContent>
							{action.items.length === 0 ? (
								<ContextMenuItem disabled>{action.emptyLabel ?? t("menu.empty")}</ContextMenuItem>
							) : (
								<ContextItems actions={action.items} />
							)}
						</ContextMenuSubContent>
					</ContextMenuSub>
				);
			case "choice":
				return (
					<ContextMenuSub key={key}>
						<ContextMenuSubTrigger>
							{action.icon && <action.icon aria-hidden />}
							{action.label}
						</ContextMenuSubTrigger>
						<ContextMenuSubContent>{action.content}</ContextMenuSubContent>
					</ContextMenuSub>
				);
			case "item":
				return (
					<ContextMenuItem
						key={key}
						variant={action.destructive ? "danger" : "default"}
						disabled={action.disabled}
						onClick={action.onSelect}
					>
						{action.icon && <action.icon aria-hidden />}
						{action.label}
						{action.shortcut && <MenuShortcut>{action.shortcut}</MenuShortcut>}
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
						<DropdownMenuSubContent>
							{action.items.length === 0 ? (
								<DropdownMenuItem disabled>{action.emptyLabel ?? t("menu.empty")}</DropdownMenuItem>
							) : (
								<DropdownItems actions={action.items} />
							)}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				);
			case "choice":
				return (
					<DropdownMenuSub key={key}>
						<DropdownMenuSubTrigger>
							{action.icon && <action.icon aria-hidden />}
							{action.label}
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>{action.content}</DropdownMenuSubContent>
					</DropdownMenuSub>
				);
			case "item":
				return (
					<DropdownMenuItem
						key={key}
						variant={action.destructive ? "danger" : "default"}
						disabled={action.disabled}
						onClick={action.onSelect}
					>
						{action.icon && <action.icon aria-hidden />}
						{action.label}
						{action.shortcut && <MenuShortcut>{action.shortcut}</MenuShortcut>}
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
			<ContextMenuTrigger render={trigger}>{children}</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextItems actions={items} />
			</ContextMenuContent>
		</ContextMenu>
	);
}

/** Always-visible `⋯` button. Opens the same items as the right-click menu. */
export function MoreActionsButton({
	actions,
	label,
}: {
	actions: MenuAction[];
	/** Button name and tooltip (e.g. `'Algorithms' folder actions`). */
	label: string;
}) {
	const items = tidy(actions);
	if (items.length === 0) return null;
	return (
		<DropdownMenu>
			<IconButton label={label} trigger={(button) => <DropdownMenuTrigger render={button} />}>
				<OverflowMenuHorizontal aria-hidden />
			</IconButton>
			<DropdownMenuContent align="end">
				<DropdownItems actions={items} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
