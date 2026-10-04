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
	/** Action buttons attached beside the handle (translate, etc.). */
	actions?: ReadonlyArray<{ id: string; label: string; icon: React.ReactNode; busy: boolean; onClick: () => void }>;
}

/** The ⋮⋮ handle on the left of a block and the block menu. The menu is a shadcn DropdownMenu (Base UI render prop) so it is keyboard operable too, and dragging the handle moves the block. */
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
				// If there are action buttons, shift left that much more to keep room for the handle.
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
			{/* Must not be modal: clicking the handle opens the menu, and a modal backdrop intercepting dragover/drop would keep the drag from ending. */}
			<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
				<IconButton
					label={t("blockHandle.label")}
					side="bottom"
					size="icon-xs"
					draggable
					onDragStart={(event) => {
						// A menu opened on press closes when dragging starts.
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
