import { imageAlignOf } from "@monti-cms/core";
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
	PickBox,
} from "@monti-cms/ui";
import { ArrowDown, ArrowUp, Copy, Repeat, Spark, TextAlignLeft, TrashCan } from "@monti-cms/ui/icons";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import { type Editor, useEditorState } from "@tiptap/react";
import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { BlockIcon } from "./block-icon";
import {
	blocksBetween,
	canMovePicked,
	duplicatePicked,
	movePicked,
	movePickedBy,
	pickedBlocks,
	removePicked,
	setPick,
} from "./block-pick";
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
import { useMarquee } from "./marquee";
import { markHeld, markMenuOpen } from "./plugins";
import { nodeName } from "./schema";
import { hasHeaderRow, toggleHeaderRow } from "./table";
import { linkOf } from "./translation";

/** Where the handle floats: 24px left of the block (the 20px grip, then 4 to the text: its glyph sits mid-grip, so it reads about 10px off), centred on the block's first line. */
type Spot = { pos: number; top: number; left: number };

const HANDLE = 24;
const LEFT = 24;
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

/**
 * A drag in progress: the block in hand (its kind and text for the card), the pointer, and where it would land. `with` are the other picked blocks
 * that go with it.
 */
type Held = { from: number; with: number[]; kind: string; text: string; x: number; y: number; drop: Drop | null };

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
/**
 * A translation's block decisions (doc 04). `from` is the source block the block is paired with. `remove` returns whether it took care of the block
 * itself (a block new in the source is left out in the core); otherwise the menu deletes the block in the text.
 */
export type BlockTranslation = {
	keep: (blockId: string, from: string) => void;
	detach: (blockId: string) => void;
	remove: (blockId: string, from: string) => boolean;
	/**
	 * "✦ Translate" for one undecided block (doc 10, item 19): the assistant proposes its translation. Left out where there is no
	 * assistant; `false` for a block the stored body does not hold yet (one new in the source), which has no row.
	 */
	translate?: (blockId: string) => void;
	translatable?: (blockId: string) => boolean;
};

export function useBlockHandle(editor: Editor | null, catalogs: BodyCatalogs, translation?: BlockTranslation) {
	const { t } = useAdmin();
	const [spot, setSpot] = useState<Spot | null>(null);
	const [open, setOpen] = useState(false);
	const [held, setHeld] = useState<Held | null>(null);
	// Set from the moment a press becomes a drag until just after it is let go, so the press that ends a drag does not open the menu.
	const dragging = useRef(false);
	/** Takes a drag's listeners off the window: the drag's end does, and so does leaving the screen with a block still in hand. */
	const letGo = useRef<(() => void) | null>(null);
	useEffect(() => () => letGo.current?.(), []);
	const element = useRef<HTMLElement | null>(null);
	// The blocks picked whole (block-pick.ts), drawn again when the pick changes.
	const picked = useEditorState({
		editor,
		selector: ({ editor: current }) => (current ? pickedBlocks(current.state) : null),
		equalityFn: (a, b) => (a ?? []).join() === (b ?? []).join(),
	});
	const marquee = useMarquee(editor);

	const point = useCallback(
		(_x: number, y: number) => {
			if (!editor?.isEditable || open || held || marquee.box) return;
			const found = blockAtLine(editor.view, y);
			if (!found) return;
			element.current = found.element;
			const next = spotOf(found.element, found.pos);
			setSpot((current) =>
				current && current.pos === next.pos && current.top === next.top && current.left === next.left ? current : next,
			);
		},
		[editor, open, held, marquee.box],
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
		// A modifier held alone is no typing: Shift is held to reach a handle and add its block to the pick.
		const typing = (event: KeyboardEvent) =>
			!open && !["Shift", "Meta", "Control", "Alt"].includes(event.key) && setSpot(null);
		// A change of the body moves its blocks: the place the handle knew is another block's now, or none's. It goes, as when a key is pressed, unless its
		// menu is open or its block is in hand (those changes are its own, and it is put away when they end).
		const changed = () => !open && !held && setSpot(null);
		window.addEventListener("scroll", follow, true);
		window.addEventListener("resize", follow);
		editor.view.dom.addEventListener("keydown", typing);
		editor.on("update", changed);
		return () => {
			window.removeEventListener("scroll", follow, true);
			window.removeEventListener("resize", follow);
			editor.view.dom.removeEventListener("keydown", typing);
			editor.off("update", changed);
		};
	}, [editor, spot, open, held]);

	const run = (make: (tr: Transaction, pos: number) => unknown) => {
		if (!editor || !spot) return;
		const tr = editor.state.tr;
		make(tr, spot.pos);
		editor.view.dispatch(tr.scrollIntoView());
		editor.commands.focus();
	};

	const changeOpen = (next: boolean, details?: { event?: Event }) => {
		// A press that became a drag does not open the menu; nor does one with Shift, which adds to the pick.
		if (next && dragging.current) return;
		if (next && details?.event instanceof MouseEvent && details.event.shiftKey) return;
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
		if (event.shiftKey) {
			// Shift on a handle picks from the first picked block (or the one the caret is in) to this one.
			event.preventDefault();
			const now = pickedBlocks(view.state);
			const caret = blockAtLine(view, view.coordsAtPos(view.state.selection.from).top + 1)?.pos ?? from;
			const ends = now ? [Math.min(now[0] ?? from, from), Math.max(now[now.length - 1] ?? from, from)] : [caret, from];
			view.dispatch(setPick(view.state.tr, blocksBetween(view, ends[0] ?? from, ends[1] ?? from)));
			view.focus();
			return;
		}
		// The handle of a picked block takes all of them; another one's lets them go, with the caret in its block.
		const together = picked && picked.length > 1 && picked.includes(from) ? picked.filter((pos) => pos !== from) : [];
		if (picked && together.length === 0) {
			const caret = TextSelection.near(view.state.doc.resolve(Math.min(from + 1, view.state.doc.content.size)));
			view.dispatch(setPick(view.state.tr, null).setSelection(caret));
		}
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
					with: together,
					kind:
						together.length > 0
							? t("editor.blocksPicked", { count: together.length + 1 })
							: node
								? kindName(node, view.state.doc.resolve(from).parent)
								: "",
					text: (node?.textContent ?? "").slice(0, 120),
					x: moved.clientX,
					y: moved.clientY,
					drop: null,
				};
				view.dispatch(markHeld(view.state, [from, ...together]));
			}
			lifted = { ...lifted, x: moved.clientX, y: moved.clientY, drop: dropAt(view, from, moved.clientY, together) };
			setHeld(lifted);
		};
		const unlisten = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("keydown", key, true);
			letGo.current = null;
		};
		const finish = (put: boolean) => {
			unlisten();
			if (!lifted) return;
			const tr = markHeld(view.state, []);
			if (put && lifted.drop) {
				if (lifted.with.length > 0)
					movePicked(
						tr,
						[from, ...lifted.with].sort((a, b) => a - b),
						lifted.drop,
					);
				else moveTo(tr, from, lifted.drop);
			}
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
		letGo.current = unlisten;
	};

	/** A block's kind as the menu names it ("Heading 2", "List item"). */
	const kindName = (node: EditorNode, parent: EditorNode) => {
		const kind = kindOf(node, parent);
		if (kind?.type === "heading") return t("editor.heading", { level: kind.level });
		const block = catalogs.kit.blocks.find((each) => nodeName(each.type) === node.type.name);
		return block ? t(block.label) : "";
	};

	const overlay = () => {
		if (marquee.box)
			return (
				<EditorOverlay
					top={marquee.box.top}
					left={marquee.box.left}
					width={marquee.box.width}
					height={marquee.box.height}
				>
					<PickBox />
				</EditorOverlay>
			);
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
		// The body may have changed under the pointer with no key pressed (a cut from the menu, an upload taken out): the handle's block may be gone,
		// its place past the end of what is left. It goes with its block; the next move of the pointer finds the block there now.
		const node = spot.pos > doc.content.size ? null : doc.nodeAt(spot.pos);
		if (!node) return null;
		const $pos = doc.resolve(spot.pos);
		const block = catalogs.kit.blocks.find((each) => nodeName(each.type) === node.type.name);
		const kind = kindOf(node, $pos.parent);
		const kinds = offeredKinds(catalogs.offered);
		const name = kind?.type === "heading" ? t("editor.heading", { level: kind.level }) : block ? t(block.label) : null;
		const isImage = block?.type === "image";
		const align = alignable(block)
			? isImage
				? imageAlignOf(node.attrs.data?.align)
				: String(node.attrs.data?.align ?? "left")
			: null;
		// A translation's top-level block carries its link (doc 04).
		const link = translation && $pos.depth === 0 ? linkOf(node) : null;
		const blockId = String(node.attrs.blockId ?? "");
		const decide = (action: (id: string) => void) => {
			changeOpen(false);
			setSpot(null);
			action(blockId);
		};

		// The handle of one of several picked blocks: the menu of them all (editor-tools.md, picking several blocks).
		if (picked && picked.length > 1 && picked.includes(spot.pos)) {
			const runPicked = (make: (tr: Transaction, blocks: number[]) => unknown) => {
				const tr = editor.state.tr;
				make(tr, picked);
				editor.view.dispatch(tr.scrollIntoView());
				editor.commands.focus();
			};
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
								<DropdownMenuLabel>{t("editor.blocksPicked", { count: picked.length })}</DropdownMenuLabel>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							{canMovePicked(doc, picked, -1) ? (
								<DropdownMenuItem onClick={() => runPicked((tr, blocks) => movePickedBy(tr, blocks, -1))}>
									<ArrowUp aria-hidden />
									{t("editor.moveUp")}
								</DropdownMenuItem>
							) : null}
							{canMovePicked(doc, picked, 1) ? (
								<DropdownMenuItem onClick={() => runPicked((tr, blocks) => movePickedBy(tr, blocks, 1))}>
									<ArrowDown aria-hidden />
									{t("editor.moveDown")}
								</DropdownMenuItem>
							) : null}
							<DropdownMenuItem onClick={() => runPicked(duplicatePicked)}>
								<Copy aria-hidden />
								{t("editor.duplicate")}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									removePicked(editor.view, picked);
									editor.commands.focus();
									setSpot(null);
								}}
							>
								<TrashCan aria-hidden />
								{t("editor.delete")}
								<MenuShortcut keys={["Backspace"]} />
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</EditorOverlay>
			);
		}

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
								{translation.translate && translation.translatable?.(blockId) !== false ? (
									<DropdownMenuItem onClick={() => decide((id) => translation.translate?.(id))}>
										<Spark aria-hidden />
										{t("translation.ai.translate")}
									</DropdownMenuItem>
								) : null}
								<DropdownMenuItem onClick={() => decide((id) => translation.keep(id, link.from))}>
									{t("translation.keepSource")}
								</DropdownMenuItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									if (translation.remove(blockId, link.from)) changeOpen(false);
									else run(deleteBlock);
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
													// The setting is dropped at the default, which is the middle for a picture and the left for words.
													const data = value === (isImage ? "center" : "left") ? rest : { ...rest, align: value };
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
