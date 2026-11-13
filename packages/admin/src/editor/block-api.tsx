"use client";

import type { BlockStarter, Label } from "@monti-cms/core";
import {
	BlockBarPlace,
	BlockBox,
	BlockFrameBox,
	BlockTitleField,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
	FloatingBar,
	FloatingBarButton,
	FormatBarRequest,
	FormFieldError,
	SourceBox,
	Stack,
	Textarea,
} from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import type { Node as EditorNode, Schema } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { NodeViewContent, useEditorState } from "@tiptap/react";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useAdmin } from "../operations/admin-context";
import { pickedBlocks } from "./block-pick";
import { codeToolsKey } from "./code/code-state";

/** The editor's node for a block type (as `schema.ts` names it). */
const nodeName = (type: string) => type.replace(/[^A-Za-z0-9_]/g, "_");

/** What a block's editor view is drawn in: its node, the editor, where it is, whether it is picked as a whole. Given by the editor's schema. */
type BlockPlace = { node: EditorNode; editor: Editor; getPos: () => number | undefined; selected: boolean };

const BlockPlaceContext = createContext<BlockPlace | null>(null);
/** Asks the assistant about a whole block (doc 10's request card, from the block's own ✦); missing where there is no assistant to ask. */
export const BlockRequestContext = createContext<((block: string) => void) | undefined>(undefined);
/** The entry's language (`ko`, `en-US`): what a block's empty title stands in for, as the site draws it. */
export const EntryLocaleContext = createContext<string | undefined>(undefined);
/** Whether the block's tool row stays up: a menu of it is open, or the keyboard is in it. */
const HoldContext = createContext<(on: boolean) => void>(() => {});
const FocusContext = createContext<(on: boolean) => void>(() => {});

export function BlockPlaceProvider({ value, children }: { value: BlockPlace; children?: ReactNode }) {
	return <BlockPlaceContext.Provider value={value}>{children}</BlockPlaceContext.Provider>;
}

/** An editor node made from a starter (`BlockDefinition.starter`, doc 18): the block as the "/" menu or a block's own + puts it in. */
export function nodeFromStarter(schema: Schema, starter: { type: string } & BlockStarter): EditorNode | null {
	const type = schema.nodes[nodeName(starter.type)];
	if (!type) return null;
	const inner = starter.children
		? starter.children.map((child) => nodeFromStarter(schema, child)).filter((each) => each !== null)
		: (starter.content ?? []).flatMap((part) => (part.type === "text" && part.text ? [schema.text(part.text)] : []));
	const data = starter.attrs && Object.keys(starter.attrs).length > 0 ? starter.attrs : null;
	return type.createAndFill({ data }, inner) ?? type.create({ data });
}

/** Attrs with a patch laid over: a value set to `undefined` is taken away; no attrs at all is `null`, as the editor keeps them. */
const patched = (current: unknown, patch: Record<string, unknown>) => {
	const next: Record<string, unknown> = { ...((current as Record<string, unknown> | null) ?? {}) };
	for (const [key, value] of Object.entries(patch)) {
		if (value === undefined) delete next[key];
		else next[key] = value;
	}
	return Object.keys(next).length > 0 ? next : null;
};

/**
 * A block's editor view reads and changes its block with this (doc 18, the block folder): its values, its children, whether it can be changed
 * here, whether it is picked or the cursor is in it, and the admin's language. Every change is one step of the editor's history, so undo takes it back.
 */
export function useBlock() {
	const place = useContext(BlockPlaceContext);
	if (!place) throw new Error("useBlock is for a block's editor view.");
	const { node, editor, getPos, selected } = place;
	const { language, t } = useAdmin();
	const locale = useContext(EntryLocaleContext);
	const ask = useContext(BlockRequestContext);
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const pos = getPos();
			const { from, to } = current.state.selection;
			const at = pos === undefined ? null : current.state.doc.nodeAt(pos);
			const inside = pos !== undefined && at !== null && from > pos && to < pos + at.nodeSize;
			// Which child the cursor is in: a block that shows one child at a time (a tab, a file) shows that one.
			let childAt: number | null = null;
			if (inside && at && pos !== undefined) {
				let start = pos + 1;
				for (let index = 0; index < at.childCount; index++) {
					const end = start + at.child(index).nodeSize;
					if (from >= start && from < end) childAt = index;
					start = end;
				}
			}
			// The code block a code link of the text is pointed at (doc 17): a block that hides it (a code explorer's file) shows it.
			const pointed = codeToolsKey.getState(current.state)?.pointed?.block ?? null;
			// Picked whole among several blocks (T80): the handle and its menu act on the pick, not the block's own tool row.
			const picked = pos !== undefined && (pickedBlocks(current.state)?.includes(pos) ?? false);
			return { editable: current.isEditable, inside, childAt, pointed, picked };
		},
	});
	return useMemo(() => {
		const pos = () => getPos() ?? -1;
		const dispatch = (change: (tr: Editor["state"]["tr"]) => void) => {
			const tr = editor.state.tr;
			change(tr);
			editor.view.dispatch(tr);
		};
		/** Where child `index` starts in the document. */
		const childPos = (index: number) => {
			const own = editor.state.doc.nodeAt(pos());
			let at = pos() + 1;
			for (let each = 0; each < index && own && each < own.childCount; each++) at += own.child(each).nodeSize;
			return at;
		};
		const children = Array.from({ length: node.childCount }, (_, index) => ({
			id: String(node.child(index).attrs.blockId ?? ""),
			type: node.child(index).type.name,
			attrs: ((node.child(index).attrs.data as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
			text: node.child(index).textContent,
			empty: node.child(index).content.size === 0 || node.child(index).textContent === "",
		}));
		return {
			attrs: ((node.attrs.data as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
			children,
			editable: state.editable,
			/** The block is picked as a whole (a block with no text: pressed, or reached by the arrows). */
			selected,
			/** The cursor or the selected words are inside the block. */
			inside: state.inside,
			/** Picked whole with other blocks (T80): its tool row stays down while the pick lasts. */
			picked: state.picked,
			/** The child the cursor is in, or `null`. */
			childAt: state.childAt,
			/** The id of the code block a code link of the text points at while it is pointed at or pressed (doc 17), or `null`. */
			pointed: state.pointed,
			language,
			/** The entry's language, as the site gets it (`renderDocument`'s `locale`); the admin's when the screen does not say. */
			locale: locale ?? language,
			/** Opens the assistant's request card on this block (its ✦); `undefined` with no assistant, or before the block has an id. */
			request:
				ask && typeof node.attrs.blockId === "string" && node.attrs.blockId !== ""
					? () => ask(String(node.attrs.blockId))
					: undefined,
			/** A name in the admin's language: words in each language, or a key of the admin's dictionary. */
			say: (label: Label) => t(label),
			setAttrs: (patch: Record<string, unknown>) =>
				dispatch((tr) =>
					tr.setNodeAttribute(pos(), "data", patched(editor.state.doc.nodeAt(pos())?.attrs.data, patch)),
				),
			/** `own` changes the block's own attrs in the same step (a tab renamed that was the one shown first). */
			setChildAttrs: (index: number, patch: Record<string, unknown>, own?: Record<string, unknown>) =>
				dispatch((tr) => {
					const at = childPos(index);
					tr.setNodeAttribute(at, "data", patched(editor.state.doc.nodeAt(at)?.attrs.data, patch));
					if (own) tr.setNodeAttribute(pos(), "data", patched(tr.doc.nodeAt(pos())?.attrs.data, own));
				}),
			/** Puts a child in at `index` (the end when left out) and the cursor in it. */
			/** `patch` changes the block's own attrs in the same step (columns go back to equal widths). */
			insertChild: (
				starter: { type: string } & BlockStarter,
				index = node.childCount,
				patch?: Record<string, unknown>,
			) => {
				const made = nodeFromStarter(editor.schema, starter);
				if (!made) return;
				dispatch((tr) => {
					const at = childPos(index);
					tr.insert(at, made);
					if (patch) tr.setNodeAttribute(pos(), "data", patched(tr.doc.nodeAt(pos())?.attrs.data, patch));
					tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)));
				});
				editor.view.focus();
			},
			removeChild: (index: number, own?: Record<string, unknown>) =>
				dispatch((tr) => {
					const at = childPos(index);
					const child = editor.state.doc.nodeAt(at);
					if (child) tr.delete(at, at + child.nodeSize);
					if (own) tr.setNodeAttribute(pos(), "data", patched(tr.doc.nodeAt(pos())?.attrs.data, own));
				}),
			/** Puts the cursor just after the block (a fold closed over the cursor: what is typed must not go where it cannot be seen). */
			leave: () => {
				dispatch((tr) => {
					const own = tr.doc.nodeAt(pos());
					if (own) tr.setSelection(TextSelection.near(tr.doc.resolve(pos() + own.nodeSize)));
				});
				editor.view.focus();
			},
			/** Takes child `from` out and puts it back before what is now child `to`. */
			moveChild: (from: number, to: number) =>
				dispatch((tr) => {
					const at = childPos(from);
					const child = editor.state.doc.nodeAt(at);
					if (!child || from === to) return;
					tr.delete(at, at + child.nodeSize);
					const own = tr.doc.nodeAt(pos());
					let place = pos() + 1;
					for (let each = 0; each < to && own && each < own.childCount; each++) place += own.child(each).nodeSize;
					tr.insert(place, child);
				}),
			/** Moves the blocks of child `from` to the end of child `to`, then takes child `from` out (a column removed keeps its words). */
			mergeChild: (from: number, to: number, patch?: Record<string, unknown>) =>
				dispatch((tr) => {
					if (patch) tr.setNodeAttribute(pos(), "data", patched(tr.doc.nodeAt(pos())?.attrs.data, patch));
					const source = editor.state.doc.nodeAt(childPos(from));
					const target = editor.state.doc.nodeAt(childPos(to));
					if (!source || !target) return;
					const start = childPos(from);
					tr.delete(start, start + source.nodeSize);
					const own = tr.doc.nodeAt(pos());
					let place = pos() + 1;
					for (let each = 0; each < (to > from ? to - 1 : to) && own; each++) place += own.child(each).nodeSize;
					const into = tr.doc.nodeAt(place);
					if (into) tr.insert(place + into.nodeSize - 1, source.content);
				}),
			/** Puts the cursor at the start of child `index` (of the block itself when left out). */
			focusChild: (index?: number) => {
				const at = index === undefined ? pos() + 1 : childPos(index) + 1;
				dispatch((tr) => tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(at, tr.doc.content.size)))));
				editor.view.focus();
			},
			/** Picks the block as a whole. */
			select: () => dispatch((tr) => tr.setSelection(NodeSelection.create(tr.doc, pos()))),
			remove: () =>
				dispatch((tr) => {
					const own = editor.state.doc.nodeAt(pos());
					if (own) tr.delete(pos(), pos() + own.nodeSize);
				}),
		};
	}, [
		node,
		editor,
		getPos,
		selected,
		state.editable,
		state.inside,
		state.childAt,
		state.picked,
		state.pointed,
		language,
		locale,
		ask,
		t,
	]);
}

/**
 * A block's own frame in the editor: what it draws, and its tool row (`bar`) over its top left (`BlockBarPlace`, the image's place), up while the pointer
 * is over the block or the cursor is in it, and while a menu of the row is open (editor-tools.md, doc 18). A body that cannot be changed has no row.
 */
export function BlockFrame({
	bar,
	measure,
	children,
	...props
}: {
	bar?: ReactNode;
	/** What a drag makes of the block, shown at its top right while it lasts ("60 : 40"). */
	measure?: string;
	children: ReactNode;
} & Omit<ComponentProps<"div">, "children">) {
	const { editable, inside, selected, picked } = useBlock();
	const [over, setOver] = useState(false);
	const [held, setHeld] = useState(0);
	const [focused, setFocused] = useState(false);
	const up = editable && !picked && bar !== undefined && (over || inside || selected || held > 0 || focused);
	return (
		<HoldContext.Provider value={(on) => setHeld((count) => Math.max(0, count + (on ? 1 : -1)))}>
			<FocusContext.Provider value={setFocused}>
				<BlockFrameBox onPointerEnter={() => setOver(true)} onPointerLeave={() => setOver(false)} {...props}>
					{/* Picked as a whole, it has the picked line around it, as a picture has. */}
					<BlockBox selected={selected} measure={measure}>
						{up && <BlockBarPlace>{bar}</BlockBarPlace>}
						{children}
					</BlockBox>
				</BlockFrameBox>
			</FocusContext.Provider>
		</HoldContext.Provider>
	);
}

/** A block's tool row (`FloatingBar`): its buttons (`BlockBarButton`, `BlockBarMenu`), named for screen readers by `label`. */
export function BlockBar({ label, children }: { label: string; children: ReactNode }) {
	const focus = useContext(FocusContext);
	return (
		<FloatingBar aria-label={label} onFocus={() => focus(true)} onBlur={() => focus(false)}>
			{children}
		</FloatingBar>
	);
}

/** A button of a block's tool row: 28px, its name in a tooltip; with words in it (`children`), its name is on it too. */
export const BlockBarButton = FloatingBarButton;

/**
 * A tool row's button that picks one value from a few (a callout's kind): a menu of the options, the current one with a ✓ on its right (menu.md).
 * The button shows the current option's icon, and its name when `named`.
 */
export function BlockBarMenu<Value extends string>({
	label,
	value,
	options,
	onChange,
	named = false,
	icon,
	text,
}: {
	/** With `named`: the words on the button whatever is picked ("File shown first"); the current option's name when left out. */
	text?: string;
	label: string;
	/** The button's own icon whatever is picked (★ for "the file shown first"); the current option's icon when left out. */
	icon?: ReactNode;
	value: Value;
	options: { value: Value; label: string; icon?: ReactNode }[];
	onChange: (value: Value) => void;
	named?: boolean;
}) {
	const hold = useContext(HoldContext);
	const current = options.find((option) => option.value === value) ?? options[0];
	return (
		<DropdownMenu onOpenChange={(open) => hold(open)}>
			<FloatingBarButton label={label} named={named} trigger={(button) => <DropdownMenuTrigger render={button} />}>
				{icon ?? current?.icon}
				{named && (text ?? current?.label)}
			</FloatingBarButton>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as Value)}>
					{options.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.icon}
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** A tool row's button that turns one value on or off, named on itself with its icon (a fold's "open at first"). Pressed is on. */
export function BlockBarToggle({
	label,
	icon,
	pressed,
	onPressedChange,
}: {
	label: string;
	icon: ReactNode;
	pressed: boolean;
	onPressedChange: (pressed: boolean) => void;
}) {
	return (
		<FloatingBarButton label={label} pressed={pressed} named onClick={() => onPressedChange(!pressed)}>
			{icon}
			{label}
		</FloatingBarButton>
	);
}

/**
 * A block written in a language of its own (a formula, a diagram, a chart, doc 18): its drawing in a box, and, while the block is picked, its source in
 * an area of its own under the drawing, set apart by a line and its own ground, named over the field. Empty, the box says what to write.
 */
export function SourceBlock({
	label,
	tools,
	source,
	empty,
	placeholder,
	errors,
	onChange,
	children,
}: {
	/** The source's name over its field ("Source"). */
	label: string;
	/** Its tool row's name for screen readers ("Formula tools"). */
	tools?: string;
	source: string;
	/** What the box says while there is no source ("Enter a formula"). */
	empty: string;
	placeholder?: string;
	errors?: string[];
	onChange: (source: string) => void;
	/** The drawing. */
	children: ReactNode;
}) {
	const { selected, request } = useBlock();
	const { t } = useAdmin();
	const box = (
		<SourceBox
			selected={selected}
			empty={source.trim() === "" ? empty : undefined}
			label={label}
			source={
				<SourcePanel
					label={label}
					value={source}
					placeholder={placeholder}
					errors={errors}
					onChange={onChange}
					autoFocus
				/>
			}
		>
			{children}
		</SourceBox>
	);
	// Its tool row has the assistant's ✦ at its end (doc 18): a request about this block, as on picked words.
	return request ? (
		<BlockFrame
			bar={
				<BlockBar label={tools ?? label}>
					<FormatBarRequest label={t("format.request")} onClick={request} />
				</BlockBar>
			}
		>
			{box}
		</BlockFrame>
	) : (
		box
	);
}

/** Holds the block's tool row up while something of it (a menu, a card) is open. */
export const useBarHold = () => useContext(HoldContext);

/**
 * A name typed in the block itself (a callout's title, a fold's title, doc 18): a one-line field in the block's own letters, written as it is typed (after
 * the composing of a Korean syllable ends). Enter goes to the block's words; Esc puts back the name it had and goes there too.
 */
export function BlockTitle({
	value,
	placeholder,
	label,
	onChange,
	onDone,
	required = false,
}: {
	/** A name that cannot be empty (a tab's): left empty, it goes back to the name it had. */
	required?: boolean;
	value: string;
	placeholder?: string;
	label: string;
	onChange: (value: string) => void;
	/** Where Enter and Esc go: the block's words. */
	onDone?: () => void;
}) {
	const { editable } = useBlock();
	const [text, setText] = useState(value);
	const composing = useRef(false);
	const before = useRef(value);
	useEffect(() => {
		if (!composing.current) setText(value);
	}, [value]);
	return (
		<BlockTitleField
			aria-label={label}
			value={text}
			placeholder={placeholder}
			readOnly={!editable}
			onFocus={() => {
				before.current = value;
			}}
			onBlur={(event) => {
				if (required && event.currentTarget.value.trim() === "") {
					setText(before.current);
					onChange(before.current);
				}
			}}
			onChange={(event) => {
				setText(event.target.value);
				if (!composing.current) onChange(event.target.value);
			}}
			onCompositionStart={() => {
				composing.current = true;
			}}
			onCompositionEnd={(event) => {
				composing.current = false;
				onChange(event.currentTarget.value);
			}}
			onKeyDown={(event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === "Enter") {
					event.preventDefault();
					onDone?.();
				}
				if (event.key === "Escape") {
					event.preventDefault();
					setText(before.current);
					onChange(before.current);
					onDone?.();
				}
			}}
		/>
	);
}

/** Where a block's children are written: the editor's own text, inside the block's view. */
export function BlockContent(props: ComponentProps<"div">) {
	return <NodeViewContent {...props} />;
}

/**
 * The source of a block written in a language of its own (a formula, a diagram, a chart, doc 18): a fixed-width field of its own under the drawing,
 * set apart from it. It writes 0.4s after typing stops, or on leaving (not while a Korean syllable is composed). Each reason it does not read is a line under it.
 */
export function SourcePanel({
	label,
	value,
	placeholder,
	errors = [],
	onChange,
	autoFocus = false,
}: {
	label: string;
	value: string;
	placeholder?: string;
	errors?: string[];
	onChange: (value: string) => void;
	autoFocus?: boolean;
}) {
	const { editable } = useBlock();
	const [text, setText] = useState(value);
	const composing = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const latest = useRef(value);
	latest.current = value;
	useEffect(() => {
		if (!composing.current && timer.current === undefined) setText(value);
	}, [value]);
	useEffect(() => () => clearTimeout(timer.current), []);
	const write = (next: string) => {
		clearTimeout(timer.current);
		timer.current = undefined;
		if (next !== latest.current) onChange(next);
	};
	const later = (next: string) => {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => write(next), 400);
	};
	return (
		<Stack gap={4} contentEditable={false}>
			<Textarea
				mono
				size="sm"
				rows={4}
				aria-label={label}
				value={text}
				placeholder={placeholder}
				readOnly={!editable}
				autoFocus={autoFocus && editable}
				aria-invalid={errors.length > 0 || undefined}
				onChange={(event) => {
					setText(event.target.value);
					if (!composing.current) later(event.target.value);
				}}
				onCompositionStart={() => {
					composing.current = true;
				}}
				onCompositionEnd={(event) => {
					composing.current = false;
					later(event.currentTarget.value);
				}}
				onBlur={(event) => write(event.currentTarget.value)}
			/>
			{errors.length > 0 && <FormFieldError errors={errors.map((message) => ({ message }))} />}
		</Stack>
	);
}

/** The admin's language, for a mark's card (which is not in a block). */
export const useBlockLanguage = () => useAdmin().language;
