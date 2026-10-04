"use client";

import { createTranslator } from "@monti-cms/core/client";
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

const t = createTranslator(sharedMessages);

/**
 * 오른쪽 클릭 메뉴와 `⋯` 버튼이 함께 쓰는 메뉴 정의(v2 A2). 같은 목록을 두 곳에서 렌더해
 * 오른쪽 클릭을 모르거나 쓸 수 없는(터치) 경우에도 같은 작업을 할 수 있게 한다.
 */
export type MenuAction =
	| {
			kind: "item";
			label: string;
			/** 항목 앞 아이콘. 메뉴 항목은 모두 아이콘을 둔다. */
			icon?: LucideIcon;
			onSelect: () => void;
			destructive?: boolean;
			disabled?: boolean;
			/** 화면에 보이는 단축키 안내. 실제 키 처리는 호출하는 쪽이 한다. */
			shortcut?: string;
	  }
	| { kind: "sub"; label: string; icon?: LucideIcon; items: MenuAction[]; emptyLabel?: string; disabled?: boolean }
	| { kind: "label"; label: string }
	| { kind: "separator" };

/** 앞뒤나 연달아 붙은 구분선을 없앤다(조건부 항목을 뺀 뒤). */
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
 * `trigger`를 오른쪽 클릭(또는 Shift+F10·메뉴 키)하면 메뉴를 연다. `trigger`는 실제로 렌더할 요소다
 * (예: `<TableRow />`). 메뉴가 비면 오른쪽 클릭을 가로채지 않는다.
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
	// 서버에서 Base UI ContextMenu를 렌더하면 뒤따르는 요소의 자동 ID(useId)가 서버와 브라우저에서 달라진다
	// (hydration 불일치). 오른쪽 클릭은 hydration 뒤에만 쓸 수 있으므로 그때 메뉴를 붙인다.
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

/** 항상 보이는 `⋯` 버튼. 오른쪽 클릭 메뉴와 같은 항목을 연다. */
export function MoreActionsButton({
	actions,
	label,
	className,
}: {
	actions: MenuAction[];
	/** 버튼 이름이자 툴팁(예: `'알고리즘' 폴더 작업`). */
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
