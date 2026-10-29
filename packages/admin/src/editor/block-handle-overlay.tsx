"use client";

import { ArrowDown, ArrowUp, Copy, Repeat, TextAlignLeft, TrashCan } from "@carbon/icons-react";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	BlockHandle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	Icon,
	MenuShortcut,
} from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import type React from "react";
import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { commonMessages } from "../lib/common.messages";
import { allowanceOfState } from "./allowed-extension";
import { addBlockBelow, canMoveBlock, deleteBlock, duplicateBlock, moveBlock } from "./block-commands";
import {
	ALIGNMENTS,
	alignBlock,
	type BlockAlign,
	type BlockKindId,
	blockAlignAt,
	blockKindAt,
	blockKinds,
	blockNameAt,
	turnBlockInto,
} from "./block-kinds";
import { markBlockMenu } from "./block-menu-mark";
import { editorMessages } from "./messages";
import type { HandleSpot } from "./use-block-handle";

/** Action an extension adds to the block menu (translate this block, ...). Shown only on a block it can act on. */
export interface BlockMenuAction {
	id: string;
	label: string;
	icon: ReactNode;
	/** The action is running on this block. */
	busy: boolean;
	onClick: () => void;
}

interface BlockHandleOverlayProps {
	editor: Editor;
	/** The block the handle is beside: where it floats and the position of the block. */
	spot: HandleSpot;
	onDragStart?: (event: React.DragEvent<HTMLElement>) => void;
	onDragEnd?: (event: React.DragEvent<HTMLElement>) => void;
	/** The block was deleted from the menu, so the handle has nothing to point at. */
	onDeleted: () => void;
	actions?: readonly BlockMenuAction[];
}

/** The + and the grip in the left margin of the pointed block. The grip opens the block menu and dragging it moves the block; the + adds a line below and opens the "/" list. */
export function BlockHandleOverlay({
	editor,
	spot,
	onDragStart,
	onDragEnd,
	onDeleted,
	actions = [],
}: BlockHandleOverlayProps) {
	const site = useSite();
	const t = useTranslator(editorMessages);
	const tc = useTranslator(commonMessages);
	const [open, setOpen] = useState(false);
	const marks = useRef<HTMLDivElement>(null);
	if (typeof window === "undefined") return null;

	const { doc } = editor.state;
	const { pos } = spot;
	const allowance = allowanceOfState(editor.state);
	const kind = blockKindAt(doc, pos);
	const align = blockAlignAt(doc, pos, allowance);
	const name = blockNameAt(site, t, doc, pos);
	const kinds = blockKinds(t, allowance);
	const canUp = canMoveBlock(doc, pos, -1);
	const canDown = canMoveBlock(doc, pos, 1);
	const choose = (run: () => unknown) => () => {
		editor.commands.focus();
		run();
	};
	const changeOpen = (next: boolean) => {
		setOpen(next);
		markBlockMenu(editor, next ? pos : null);
	};

	return createPortal(
		<div
			ref={marks}
			style={{ position: "fixed", top: `${spot.top + 4}px`, left: `${Math.max(8, spot.left - 64)}px`, zIndex: 40 }}
			className="flex items-center"
		>
			{/* Must not be modal: clicking the handle opens the menu, and a modal backdrop intercepting dragover/drop would keep the drag from ending. */}
			<DropdownMenu open={open} onOpenChange={changeOpen} modal={false}>
				<BlockHandle
					addLabel={t("blockHandle.add")}
					gripLabel={t("blockHandle.label")}
					active={open}
					onAdd={() => addBlockBelow(editor, pos)}
					draggable
					onDragStart={(event) => {
						// A menu opened on press closes when dragging starts.
						changeOpen(false);
						onDragStart?.(event);
					}}
					onDragEnd={onDragEnd}
					trigger={(grip) => <DropdownMenuTrigger render={grip} />}
				/>
				{/* Under the + and the grip, its left edge at the +, so the menu leaves the block's text in view. */}
				<DropdownMenuContent side="bottom" align="start" anchor={marks}>
					<DropdownMenuGroup>
						{name && <DropdownMenuLabel>{name}</DropdownMenuLabel>}
						{kind && (
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<Repeat aria-hidden />
									{t("blockHandle.turnInto")}
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									<DropdownMenuRadioGroup
										value={kind}
										onValueChange={(next) => choose(() => turnBlockInto(editor, pos, next as BlockKindId))()}
									>
										{kinds.map((item) => (
											<DropdownMenuRadioItem key={item.id} value={item.id}>
												{item.label}
												{item.shortcut && <MenuShortcut>{item.shortcut}</MenuShortcut>}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						)}
						{align && (
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<TextAlignLeft aria-hidden />
									{t("blockHandle.align")}
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									<DropdownMenuRadioGroup
										value={align}
										onValueChange={(next) => choose(() => alignBlock(editor, pos, next as BlockAlign))()}
									>
										{ALIGNMENTS.map((item) => (
											<DropdownMenuRadioItem key={item.id} value={item.id}>
												<Icon icon={item.icon} tone="muted" />
												{t(item.key)}
											</DropdownMenuRadioItem>
										))}
									</DropdownMenuRadioGroup>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						)}
						{actions.map((action) => (
							<DropdownMenuItem key={action.id} disabled={action.busy} onClick={action.onClick}>
								{action.icon}
								{action.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					{canUp && (
						<DropdownMenuItem onClick={choose(() => moveBlock(editor, pos, -1))}>
							<ArrowUp aria-hidden />
							{t("blockHandle.moveUp")}
							<MenuShortcut keys={["alt", "ArrowUp"]} />
						</DropdownMenuItem>
					)}
					{canDown && (
						<DropdownMenuItem onClick={choose(() => moveBlock(editor, pos, 1))}>
							<ArrowDown aria-hidden />
							{t("blockHandle.moveDown")}
							<MenuShortcut keys={["alt", "ArrowDown"]} />
						</DropdownMenuItem>
					)}
					<DropdownMenuItem onClick={choose(() => duplicateBlock(editor, pos))}>
						<Copy aria-hidden />
						{t("blockHandle.duplicate")}
						<MenuShortcut keys={["mod", "shift", "D"]} />
					</DropdownMenuItem>
					{/* Not red: a deleted block comes back with undo. */}
					<DropdownMenuItem
						onClick={choose(() => {
							deleteBlock(editor, pos);
							onDeleted();
						})}
					>
						<TrashCan aria-hidden />
						{tc("delete")}
						<MenuShortcut keys={["mod", "shift", "Backspace"]} />
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>,
		document.body,
	);
}
