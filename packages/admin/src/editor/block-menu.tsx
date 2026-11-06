import {
	BlockHandle,
	DropdownMenu,
	DropdownMenuCheckboxItem,
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
	DropLine,
	EditorOverlay,
	HeldBlock,
	MenuShortcut,
} from "@monti-cms/ui";
import { ArrowDown, ArrowUp, Copy, Repeat, TextAlignLeft, TrashCan } from "@monti-cms/ui/icons";
import type { Node as EditorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { BlockIcon } from "./block-icon";
import { alignable, type BodyCatalogs } from "./catalog";
import {
	canMove,
	deleteBlock,
	duplicateBlock,
	KIND_SHORTCUTS,
	kindKey,
	kindOf,
	moveBlock,
	offeredKinds,
	turnInto,
} from "./commands";
import { blockAtLine, type Drop, dropAt, moveTo } from "./drag";
import { markHeld, markMenuOpen } from "./plugins";
import { nodeName } from "./schema";
import { hasHeaderRow, toggleHeaderRow } from "./table";
import { linkOf } from "./translation";

/** Where the handle floats: 32px left of the block (the 24px grip, then 8 to the text), centred on the block's first line. */
type Spot = { pos: number; top: number; left: number };

const HANDLE = 24;
const LEFT = 32;
/** How far left of the text the pointer still counts as on a block's line: the margin the handle sits in, and some room to reach it. */
const REACH = 64;

/** The handle's place beside a block's element. A list item's handle sits left of its list, so the bullet stays in view. */
function spotOf(element: HTMLElement, pos: number): Spot {
	const rect = element.getBoundingClientRect();
	const inList = element.tagName === "LI" ? element.parentElement : null;
	const left = (inList ?? element).getBoundingClientRect().left;
	const line = Number.parseFloat(getComputedStyle(element).lineHeight) || HANDLE;
	return { pos, top: rect.top + Math.max(0, (line - HANDLE) / 2), left: left - LEFT };
}

/** A drag in progress: the block in hand (its kind and text for the card), the pointer, and where it would land. */
type Held = { from: number; kind: string; text: string; x: number; y: number; drop: Drop | null };

/** The pointer moves this far (px) before a press on the grip becomes a drag, so a press still opens the menu (list.md, `Sortable`). */
const DRAG_AFTER = 4;

/** Where the card in hand sits from the pointer (px): beside it, so it never covers the line where the block lands. */
const CARD_RIGHT = 16;
const CARD_BELOW = 8;

/** The drop line's ring sticks out this far (px) left of the block it lands beside. */
const RING_OUT = 4;

/**
 * The block handle (doc 03, editor-tools.md): the + and the grip in the margin of the block under the pointer. The + puts an empty line with "/" under
 * the block; the grip opens the block menu, and dragging it moves the block. The menu hides what cannot be done (the first block's "move up").
 */
/** What a translation's block menu does besides the usual (doc 04): keep a pending block in the source's words, or change a followed one here. */
export type BlockTranslation = { keep: (blockId: string) => void; detach: (blockId: string) => void };

export function useBlockHandle(editor: Editor | null, catalogs: BodyCatalogs, translation?: BlockTranslation) {
	const { t } = useAdmin();
	const [spot, setSpot] = useState<Spot | null>(null);
	const [open, setOpen] = useState(false);
	const [held, setHeld] = useState<Held | null>(null);
	// Set from the moment a press becomes a drag until just after it is let go, so the press that ends a drag does not open the menu.
	const dragging = useRef(false);
	const element = useRef<HTMLElement | null>(null);

	const point = useCallback(
		(_x: number, y: number) => {
			if (!editor?.isEditable || open || held) return;
			const found = blockAtLine(editor.view, y);
			if (!found) return;
			element.current = found.element;
			const next = spotOf(found.element, found.pos);
			setSpot((current) =>
				current && current.pos === next.pos && current.top === next.top && current.left === next.left ? current : next,
			);
		},
		[editor, open, held],
	);

	// The pointer is watched over the text and over the margin left of it where the handle sits (as Notion does): reaching for the handle from the
	// side shows it too.
	useEffect(() => {
		if (!editor) return;
		const move = (event: MouseEvent) => {
			const body = editor.view.dom.getBoundingClientRect();
			if (event.clientX < body.left - REACH || event.clientX > body.right) return;
			if (event.clientY < body.top || event.clientY > body.bottom) return;
			point(event.clientX, event.clientY);
		};
		window.addEventListener("mousemove", move);
		return () => window.removeEventListener("mousemove", move);
	}, [editor, point]);

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
		// A press that became a drag does not open the menu.
		if (next && dragging.current) return;
		setOpen(next);
		if (editor) editor.view.dispatch(markMenuOpen(editor.state, next && spot ? spot.pos : null));
	};

	/**
	 * Dragging the grip (list.md, moving by dragging): after 4px the block lifts, its place stays as a gap, its copy follows the pointer and a line shows
	 * where it lands. Letting go moves it; Esc puts it back. A press without a move still opens the menu.
	 */
	const pressGrip = (event: PointerEvent<HTMLElement>) => {
		if (!editor || !spot || event.button !== 0 || !element.current) return;
		const { view } = editor;
		const from = spot.pos;
		const startX = event.clientX;
		const startY = event.clientY;
		let lifted: Held | null = null;
		const move = (moved: globalThis.PointerEvent) => {
			if (!lifted) {
				if (Math.hypot(moved.clientX - startX, moved.clientY - startY) < DRAG_AFTER) return;
				dragging.current = true;
				changeOpen(false);
				const node = view.state.doc.nodeAt(from);
				lifted = {
					from,
					kind: node ? kindName(node, view.state.doc.resolve(from).parent) : "",
					text: (node?.textContent ?? "").slice(0, 120),
					x: moved.clientX,
					y: moved.clientY,
					drop: null,
				};
				view.dispatch(markHeld(view.state, from));
			}
			lifted = { ...lifted, x: moved.clientX, y: moved.clientY, drop: dropAt(view, from, moved.clientY) };
			setHeld(lifted);
		};
		const finish = (put: boolean) => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("keydown", key, true);
			if (!lifted) return;
			const tr = markHeld(view.state, null);
			if (put && lifted.drop) moveTo(tr, from, lifted.drop);
			view.dispatch(tr.scrollIntoView());
			view.focus();
			setHeld(null);
			setSpot(null);
			setTimeout(() => {
				dragging.current = false;
			}, 0);
		};
		const up = () => finish(true);
		const key = (pressed: KeyboardEvent) => {
			if (pressed.key !== "Escape") return;
			pressed.preventDefault();
			finish(false);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("keydown", key, true);
	};

	/** A block's kind as the menu names it ("Heading 2", "List item"). */
	const kindName = (node: EditorNode, parent: EditorNode) => {
		const kind = kindOf(node, parent);
		if (kind?.type === "heading") return t("editor.heading", { level: kind.level });
		const block = catalogs.kit.blocks.find((each) => nodeName(each.type) === node.type.name);
		return block ? t(block.label) : "";
	};

	const overlay = () => {
		if (held)
			return (
				<>
					<EditorOverlay top={held.y + CARD_BELOW} left={held.x + CARD_RIGHT}>
						<HeldBlock kind={held.kind} text={held.text} />
					</EditorOverlay>
					{held.drop ? (
						<EditorOverlay
							top={held.drop.line.top}
							left={held.drop.line.left - RING_OUT}
							width={held.drop.line.width + RING_OUT}
						>
							<DropLine />
						</EditorOverlay>
					) : null}
				</>
			);
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
		// A translation's top-level block carries its link (doc 04).
		const link = translation && $pos.depth === 0 ? linkOf(node) : null;
		const blockId = String(node.attrs.blockId ?? "");
		const decide = (action: (id: string) => void) => {
			changeOpen(false);
			setSpot(null);
			action(blockId);
		};

		// A block still in the source's words: decide what it becomes, block by block (translation.md: the dimmed block's menu).
		if (link?.state === "pending" && translation)
			return (
				<EditorOverlay top={spot.top} left={spot.left}>
					<DropdownMenu open={open} onOpenChange={changeOpen} modal={false}>
						<BlockHandle
							gripLabel={t("editor.blockMenu")}
							active={open}
							onPointerDown={pressGrip}
							trigger={(grip) => <DropdownMenuTrigger render={grip} />}
						/>
						<DropdownMenuContent side="bottom" align="start" alignOffset={-18} sideOffset={6}>
							<DropdownMenuGroup>
								{name ? <DropdownMenuLabel>{name}</DropdownMenuLabel> : null}
								<DropdownMenuItem onClick={() => decide(translation.keep)}>
									{t("translation.keepSource")}
								</DropdownMenuItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									run(deleteBlock);
									setSpot(null);
								}}
							>
								<TrashCan aria-hidden />
								{t("translation.remove")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</EditorOverlay>
			);

		return (
			<EditorOverlay top={spot.top} left={spot.left}>
				<DropdownMenu open={open} onOpenChange={changeOpen} modal={false}>
					<BlockHandle
						gripLabel={t("editor.blockMenu")}
						active={open}
						onPointerDown={pressGrip}
						trigger={(grip) => <DropdownMenuTrigger render={grip} />}
					/>
					<DropdownMenuContent side="bottom" align="start" alignOffset={-18} sideOffset={6}>
						<DropdownMenuGroup>
							{name ? <DropdownMenuLabel>{name}</DropdownMenuLabel> : null}
							{link?.state === "followSource" && translation ? (
								<DropdownMenuItem onClick={() => decide(translation.detach)}>
									{t("translation.detach")}
								</DropdownMenuItem>
							) : null}
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
													<BlockIcon type={each.type} level={each.type === "heading" ? each.level : undefined} />
													{each.type === "heading"
														? t("editor.heading", { level: each.level })
														: t(catalogs.kit.blocks.find((b) => b.type === each.type)?.label ?? each.type)}
													{KIND_SHORTCUTS[kindKey(each)] ? (
														<MenuShortcut typed>{KIND_SHORTCUTS[kindKey(each)]}</MenuShortcut>
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
							{node.type.name === "table" ? (
								<DropdownMenuCheckboxItem
									checked={hasHeaderRow(node)}
									onCheckedChange={() => run((tr, pos) => toggleHeaderRow(tr, pos))}
								>
									{t("table.headerRow")}
								</DropdownMenuCheckboxItem>
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
	return { overlay: overlay() };
}
