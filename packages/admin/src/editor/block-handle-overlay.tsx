"use client";

import { createTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { IconButton } from "../ui/icon-button";
import { Spinner } from "../ui/spinner";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

interface BlockHandleOverlayProps {
	coords: { top: number; left: number };
	onMoveUp: () => void;
	onMoveDown: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	onDragStart?: (event: React.DragEvent<HTMLElement>) => void;
	onDragEnd?: (event: React.DragEvent<HTMLElement>) => void;
	/** 손잡이 옆에 붙는 동작 버튼(번역 등). */
	actions?: ReadonlyArray<{ id: string; label: string; icon: React.ReactNode; busy: boolean; onClick: () => void }>;
}

/** 블록 왼쪽의 ⋮⋮ 핸들과 블록 메뉴(§4.2). 메뉴는 shadcn DropdownMenu(Base UI 기반 render prop)라 키보드로도 조작하며, 핸들을 끌어 블록을 드래그 이동한다. */
export function BlockHandleOverlay({
	coords,
	onMoveUp,
	onMoveDown,
	onDuplicate,
	onDelete,
	onDragStart,
	onDragEnd,
	actions = [],
}: BlockHandleOverlayProps) {
	const [open, setOpen] = useState(false);
	if (typeof window === "undefined") return null;

	return createPortal(
		<div
			style={{
				position: "fixed",
				top: `${coords.top}px`,
				// 동작 버튼이 있으면 그만큼 왼쪽으로 더 내어 손잡이 자리를 지킨다.
				left: `${Math.max(8, coords.left - 32 - actions.length * 24)}px`,
				zIndex: 40,
			}}
			className="flex items-center"
		>
			{actions.map((action) => (
				<IconButton
					key={action.id}
					label={action.label}
					side="bottom"
					size="icon-xs"
					disabled={action.busy}
					onClick={action.onClick}
					className="text-cms-muted-foreground hover:text-cms-foreground"
				>
					{action.busy ? <Spinner className="size-3" /> : action.icon}
				</IconButton>
			))}
			{/* 모달이 아니어야 한다: 핸들을 누르면 메뉴가 열리는데, 모달 배경이 dragover·drop을 가로채면 드래그가 끝나지 않는다. */}
			<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
				<IconButton
					label={t("blockHandle.label")}
					side="bottom"
					size="icon-xs"
					draggable
					onDragStart={(event) => {
						// 누를 때 열린 메뉴는 끌기 시작하면 닫는다.
						setOpen(false);
						onDragStart?.(event);
					}}
					onDragEnd={onDragEnd}
					className="cursor-grab text-cms-muted-foreground active:cursor-grabbing"
					trigger={(button) => <DropdownMenuTrigger render={button} />}
				>
					<GripVertical aria-hidden />
				</IconButton>
				<DropdownMenuContent align="start" side="right" className="w-56">
					<DropdownMenuItem onClick={onMoveUp}>
						<ArrowUp aria-hidden />
						{t("blockHandle.moveUp")}
						<DropdownMenuShortcut>⌥↑</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onMoveDown}>
						<ArrowDown aria-hidden />
						{t("blockHandle.moveDown")}
						<DropdownMenuShortcut>⌥↓</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onClick={onDuplicate}>
						<Copy aria-hidden />
						{t("blockHandle.duplicate")}
						<DropdownMenuShortcut>⇧⌘D</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" onClick={onDelete}>
						<Trash2 aria-hidden />
						{t("blockHandle.delete")}
						<DropdownMenuShortcut>⇧⌘⌫</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>,
		document.body,
	);
}
