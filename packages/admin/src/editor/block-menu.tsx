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
	EditorOverlay,
	MenuShortcut,
} from "@monti-cms/ui";
import { ArrowDown, ArrowUp, Copy, Repeat, TextAlignLeft, TrashCan } from "@monti-cms/ui/icons";
import { NodeSelection, type Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { alignable, type BodyCatalogs } from "./catalog";
import {
	addBelow,
	canMove,
	deleteBlock,
	duplicateBlock,
	handleTarget,
	KIND_SHORTCUTS,
	kindKey,
	kindOf,
	moveBlock,
	offeredKinds,
	turnInto,
} from "./commands";
import { markMenuOpen } from "./plugins";
import { nodeName } from "./schema";

/** Where the handle floats: 64px left of the block (the + and the grip, 8 apart, then 8 to the text), centred on the block's first line. */
type Spot = { pos: number; top: number; left: number };

const HANDLE = 24;
const LEFT = 64;

/** The handle's place beside a block's element. A list item's handle sits left of its list, so the bullet stays in view. */
function spotOf(element: HTMLElement, pos: number): Spot {
	const rect = element.getBoundingClientRect();
	const inList = element.tagName === "LI" ? element.parentElement : null;
	const left = (inList ?? element).getBoundingClientRect().left;
	const line = Number.parseFloat(getComputedStyle(element).lineHeight) || HANDLE;
	return { pos, top: rect.top + Math.max(0, (line - HANDLE) / 2), left: left - LEFT };
}

/** The block under the pointer that has a handle, and its element. */
function blockAt(editor: Editor, x: number, y: number): { pos: number; element: HTMLElement } | null {
	const { view } = editor;
	const hit = view.posAtCoords({ left: x, top: y });
	if (!hit) return null;
	const atom = hit.inside >= 0 ? view.state.doc.nodeAt(hit.inside) : null;
	const pos = atom?.isBlock && atom.isAtom ? hit.inside : handleTarget(view.state.doc.resolve(hit.pos));
	if (pos === null) return null;
	const element = view.nodeDOM(pos);
	return element instanceof HTMLElement ? { pos, element } : null;
}

/**
 * The block handle (doc 03, editor-tools.md): the + and the grip in the margin of the block under the pointer. The + puts an empty line with "/" under
 * the block; the grip opens the block menu, and dragging it moves the block. The menu hides what cannot be done (the first block's "move up").
 */
export function useBlockHandle(editor: Editor | null, catalogs: BodyCatalogs) {
	const { t } = useAdmin();
	const [spot, setSpot] = useState<Spot | null>(null);
	const [open, setOpen] = useState(false);
	const element = useRef<HTMLElement | null>(null);

	const point = useCallback(
		(x: number, y: number) => {
			if (!editor?.isEditable || open) return;
			const found = blockAt(editor, x, y);
			if (!found) return;
			element.current = found.element;
			const next = spotOf(found.element, found.pos);
			setSpot((current) =>
				current && current.pos === next.pos && current.top === next.top && current.left === next.left ? current : next,
			);
		},
		[editor, open],
	);

	// The handle follows its block when the page scrolls or the block moves, and goes when the block has gone or the person types.
	useEffect(() => {
		if (!editor || !spot) return;
		const follow = () => {
			const current = element.current;
			if (!current?.isConnected) return setSpot(null);
			setSpot((now) => (now ? spotOf(current, now.pos) : now));
		};
		const typing = () => !open && setSpot(null);
		window.addEventListener("scroll", follow, true);
		window.addEventListener("resize", follow);
		editor.view.dom.addEventListener("keydown", typing);
		return () => {
			window.removeEventListener("scroll", follow, true);
			window.removeEventListener("resize", follow);
			editor.view.dom.removeEventListener("keydown", typing);
		};
	}, [editor, spot, open]);

	const run = (make: (tr: Transaction, pos: number) => unknown) => {
		if (!editor || !spot) return;
		const tr = editor.state.tr;
		make(tr, spot.pos);
		editor.view.dispatch(tr.scrollIntoView());
		editor.commands.focus();
	};

	const changeOpen = (next: boolean) => {
		setOpen(next);
		if (editor) editor.view.dispatch(markMenuOpen(editor.state, next && spot ? spot.pos : null));
	};

	const dragStart = (event: DragEvent<HTMLElement>) => {
		if (!editor || !spot) return;
		changeOpen(false);
		const { view } = editor;
		const selection = NodeSelection.create(view.state.doc, spot.pos);
		view.dispatch(view.state.tr.setSelection(selection));
		// The editor moves what is being dragged when it is dropped in the text, as a move of the block itself (it keeps its id).
		view.dragging = { slice: selection.content(), move: true };
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", selection.node.textContent);
		if (element.current) event.dataTransfer.setDragImage(element.current, 0, 0);
	};

	const overlay = () => {
		if (!editor || !spot || !editor.isEditable) return null;
		const { doc } = editor.state;
		const node = doc.nodeAt(spot.pos);
		if (!node) return null;
		const $pos = doc.resolve(spot.pos);
		const block = catalogs.kit.blocks.find((each) => nodeName(each.type) === node.type.name);
		const kind = kindOf(node, $pos.parent);
		const kinds = offeredKinds(catalogs.offered);
		const name = kind?.type === "heading" ? t("editor.heading", { level: kind.level }) : block ? t(block.label) : null;
		const align = alignable(block) ? String(node.attrs.data?.align ?? "left") : null;

		return (
			<EditorOverlay top={spot.top} left={spot.left}>
				<DropdownMenu open={open} onOpenChange={changeOpen} modal={false}>
					<BlockHandle
						addLabel={t("editor.add")}
						gripLabel={t("editor.blockMenu")}
						active={open}
						onAdd={() => run(addBelow)}
						draggable
						onDragStart={dragStart}
						trigger={(grip) => <DropdownMenuTrigger render={grip} />}
					/>
					<DropdownMenuContent side="bottom" align="start" alignOffset={-18} sideOffset={6}>
						<DropdownMenuGroup>
							{name ? <DropdownMenuLabel>{name}</DropdownMenuLabel> : null}
							{kind && kinds.length > 1 ? (
								<DropdownMenuSub>
									<DropdownMenuSubTrigger>
										<Repeat aria-hidden />
										{t("editor.turnInto")}
									</DropdownMenuSubTrigger>
									<DropdownMenuSubContent>
										<DropdownMenuRadioGroup
											value={kindKey(kind)}
											onValueChange={(value) => {
												const next = kinds.find((each) => kindKey(each) === value);
												if (next) run((tr, pos) => turnInto(tr, pos, next));
											}}
										>
											{kinds.map((each) => (
												<DropdownMenuRadioItem key={kindKey(each)} value={kindKey(each)}>
													{each.type === "heading"
														? t("editor.heading", { level: each.level })
														: t(catalogs.kit.blocks.find((b) => b.type === each.type)?.label ?? each.type)}
													{KIND_SHORTCUTS[kindKey(each)] ? (
														<MenuShortcut>{KIND_SHORTCUTS[kindKey(each)]}</MenuShortcut>
													) : null}
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuSubContent>
								</DropdownMenuSub>
							) : null}
							{align ? (
								<DropdownMenuSub>
									<DropdownMenuSubTrigger>
										<TextAlignLeft aria-hidden />
										{t("editor.align")}
									</DropdownMenuSubTrigger>
									<DropdownMenuSubContent>
										<DropdownMenuRadioGroup
											value={align}
											onValueChange={(value) =>
												run((tr, pos) => {
													const { align: _old, ...rest } = (node.attrs.data ?? {}) as Record<string, unknown>;
													const data = value === "left" ? rest : { ...rest, align: value };
													tr.setNodeAttribute(pos, "data", Object.keys(data).length ? data : null);
												})
											}
										>
											<DropdownMenuRadioItem value="left">{t("editor.alignLeft")}</DropdownMenuRadioItem>
											<DropdownMenuRadioItem value="center">{t("editor.alignCenter")}</DropdownMenuRadioItem>
											<DropdownMenuRadioItem value="right">{t("editor.alignRight")}</DropdownMenuRadioItem>
										</DropdownMenuRadioGroup>
									</DropdownMenuSubContent>
								</DropdownMenuSub>
							) : null}
						</DropdownMenuGroup>
						{name || kind || align ? <DropdownMenuSeparator /> : null}
						{canMove(doc, spot.pos, -1) ? (
							<DropdownMenuItem onClick={() => run((tr, pos) => moveBlock(tr, pos, -1))}>
								<ArrowUp aria-hidden />
								{t("editor.moveUp")}
								<MenuShortcut keys={["alt", "ArrowUp"]} />
							</DropdownMenuItem>
						) : null}
						{canMove(doc, spot.pos, 1) ? (
							<DropdownMenuItem onClick={() => run((tr, pos) => moveBlock(tr, pos, 1))}>
								<ArrowDown aria-hidden />
								{t("editor.moveDown")}
								<MenuShortcut keys={["alt", "ArrowDown"]} />
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem onClick={() => run(duplicateBlock)}>
							<Copy aria-hidden />
							{t("editor.duplicate")}
							<MenuShortcut keys={["mod", "shift", "D"]} />
						</DropdownMenuItem>
						{/* Not red: a deleted block comes back with undo. */}
						<DropdownMenuItem
							onClick={() => {
								run(deleteBlock);
								setSpot(null);
							}}
						>
							<TrashCan aria-hidden />
							{t("editor.delete")}
							<MenuShortcut keys={["mod", "shift", "Backspace"]} />
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</EditorOverlay>
		);
	};
	return { point, overlay: overlay() };
}
