"use client";

import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { type NodeViewProps, useEditorState } from "@tiptap/react";
import { Settings2 } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { IconButton } from "../../ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { blocksMessages } from "./messages";

const t = createTranslator(blocksMessages);

/** Selected block border. All blocks use the same look. */
export const SELECTED_RING = "ring-2 ring-cms-ring ring-offset-2 ring-offset-cms-background";

/** Look of the control toolbar floating over a block (shared by the block toolbar, images, and tables). */
export const BLOCK_TOOLBAR =
	"z-10 flex items-center gap-0.5 rounded-md border bg-cms-popover/95 p-0.5 text-cms-popover-foreground shadow-sm backdrop-blur";

export type ContainerValues = Record<string, string | boolean>;

export const valuesOf = (node: PmNode): ContainerValues => (node.attrs.values ?? {}) as ContainerValues;

/** Emptied values (empty string, false) are removed from attributes. Keeping them would save a `title=""` that was not in the source. */
export const withValue = (values: ContainerValues, key: string, value: string | boolean): ContainerValues => {
	const { [key]: _removed, ...rest } = values;
	return value === "" || value === false ? rest : { ...rest, [key]: value };
};

export const useContainerValues = ({ node, updateAttributes }: Pick<NodeViewProps, "node" | "updateAttributes">) => {
	const values = valuesOf(node);
	const setValue = (key: string, value: string | boolean) =>
		updateAttributes({ values: withValue(values, key, value) });
	return [values, setValue] as const;
};

/**
 * Whether the editor can be edited. Re-renders when the lock (trash, raw mode) changes.
 * A node view that reads `editor.isEditable` once while rendering does not follow lock changes, so use this.
 */
export function useEditorEditable(editor: Editor | null | undefined): boolean {
	// When rendering without an editor (preview, fake editor in tests), do not subscribe and read the value at that time.
	const tracked = typeof editor?.on === "function" ? editor : null;
	const editable = useEditorState({
		editor: tracked,
		selector: ({ editor: current }) => current?.isEditable ?? true,
	});
	return tracked ? (editable ?? true) : (editor?.isEditable ?? true);
}

/** Start position of the i-th child inside the parent container. */
export const childPos = (parent: PmNode, parentPos: number, index: number) => {
	let offset = parentPos + 1;
	for (let i = 0; i < index; i += 1) offset += parent.child(i).nodeSize;
	return offset;
};

/**
 * Which child of this container the current selection is in. -1 if outside.
 * -1 when the editor has no focus, so that the cursor at the very start of the document when first opening a post (the first tab if the first block is tabs)
 * does not overwrite the initial open tab or collapsed state.
 */
export const useSelectedChildIndex = (editor: Editor, getPos: NodeViewProps["getPos"]) =>
	useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const pos = getPos();
			if (!current?.isFocused || typeof pos !== "number") return -1;
			const parent = current.state.doc.nodeAt(pos);
			const { from } = current.state.selection;
			if (!parent || from <= pos || from >= pos + parent.nodeSize) return -1;
			let offset = pos + 1;
			for (let i = 0; i < parent.childCount; i += 1) {
				const end = offset + parent.child(i).nodeSize;
				if (from >= offset && from < end) return i;
				offset = end;
			}
			return -1;
		},
	}) ?? -1;

/** Moves the cursor into the container (a child index or the start of the body). */
export const focusInside = (editor: Editor, getPos: NodeViewProps["getPos"], index?: number) => {
	const pos = getPos();
	if (typeof pos !== "number") return;
	editor
		.chain()
		.focus()
		.command(({ tr }) => {
			const parent = tr.doc.nodeAt(pos);
			if (!parent) return false;
			const start = index === undefined ? pos + 1 : childPos(parent, pos, index) + 1;
			tr.setSelection(TextSelection.near(tr.doc.resolve(start)));
			return true;
		})
		.scrollIntoView()
		.run();
};

/** Selects the whole container (when no cursor should be left inside the body to hide). */
export const selectContainer = (editor: Editor, getPos: NodeViewProps["getPos"]) => {
	const pos = getPos();
	if (typeof pos !== "number") return;
	editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
};

/**
 * Input field for attributes (title, tab name). During Korean composition it does not write to the document, and writes when composition ends.
 * Enter returns to the body and Escape returns to the editor.
 */
export function AttributeInput({
	value,
	onCommit,
	onEnter,
	onEscape,
	required = false,
	onBlur,
	className,
	...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "defaultValue"> & {
	value: string;
	onCommit: (value: string) => void;
	onEnter?: () => void;
	onEscape?: () => void;
	/** Do not write an emptied value (tab name). Leaving it empty restores the original value. */
	required?: boolean;
}) {
	const [draft, setDraft] = useState(value);
	const composingRef = useRef(false);
	const focusedRef = useRef(false);
	// Values are written to the document on every input, so remember the value to restore on Escape when the field is entered.
	const initialRef = useRef(value);
	// Keep the blur following Escape from writing the just-typed value again (the draft state is not updated yet).
	const escapingRef = useRef(false);

	// The last value written to the document. Even if another write follows before the render catches up (e.g. right after Escape), the comparison stays consistent.
	const committedRef = useRef(value);

	// When the value changes from outside such as undo, follow it only when not typing.
	useEffect(() => {
		committedRef.current = value;
		if (!focusedRef.current) setDraft(value);
	}, [value]);

	const commit = (next: string) => {
		if (required && !next.trim()) return;
		if (next === committedRef.current) return;
		committedRef.current = next;
		onCommit(next);
	};

	return (
		<input
			{...props}
			value={draft}
			onFocus={() => {
				focusedRef.current = true;
				initialRef.current = committedRef.current;
			}}
			onBlur={(event) => {
				focusedRef.current = false;
				if (escapingRef.current) escapingRef.current = false;
				else commit(draft);
				if (required && !draft.trim()) setDraft(value);
				onBlur?.(event);
			}}
			onChange={(event) => {
				setDraft(event.target.value);
				if (!composingRef.current) commit(event.target.value);
			}}
			onCompositionStart={() => {
				composingRef.current = true;
			}}
			onCompositionEnd={(event) => {
				composingRef.current = false;
				commit(event.currentTarget.value);
			}}
			onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
				if (event.nativeEvent.isComposing || composingRef.current) return;
				if (event.key === "Enter") {
					event.preventDefault();
					commit(draft);
					onEnter?.();
				} else if (event.key === "Escape") {
					event.preventDefault();
					escapingRef.current = true;
					setDraft(initialRef.current);
					commit(initialRef.current);
					onEscape?.();
				}
			}}
			className={cn(
				"min-w-0 border-0 bg-transparent p-0 outline-none placeholder:text-current placeholder:opacity-50 focus-visible:ring-0",
				className,
			)}
		/>
	);
}

/** Control toolbar shown only when the mouse is over the container or the cursor is inside. */
export function ContainerToolbar({
	visible,
	className,
	children,
	label,
}: {
	visible?: boolean;
	className?: string;
	children: ReactNode;
	label: string;
}) {
	return (
		<div
			role="toolbar"
			aria-label={label}
			contentEditable={false}
			className={cn(
				BLOCK_TOOLBAR,
				"absolute -top-3.5 right-2 transition-opacity",
				"opacity-0 group-focus-within/container:opacity-100 group-hover/container:opacity-100 has-aria-expanded:opacity-100",
				visible && "opacity-100",
				className,
			)}
		>
			{children}
		</div>
	);
}

/** Icon button of the toolbar. Its name shows on mouse hover. */
export function ToolbarButton(props: ComponentProps<typeof IconButton>) {
	return <IconButton size="icon-xs" {...props} />;
}

/**
 * Block settings button and its popover. All block attributes (width, alt text, initial state, etc.) go here.
 * Align the fields inside with `BlockSettingsField`.
 */
export function BlockSettings({
	label = t("settings.label"),
	open,
	onOpenChange,
	children,
}: {
	label?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: ReactNode;
}) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<ToolbarButton label={label} trigger={(button) => <PopoverTrigger render={button} />}>
				<Settings2 aria-hidden />
			</ToolbarButton>
			<PopoverContent align="end" className="flex w-72 flex-col gap-3 p-3 text-xs">
				{children}
			</PopoverContent>
		</Popover>
	);
}

/** One field in the settings popover (name above, input below). */
export function BlockSettingsField({
	label,
	htmlFor,
	action,
	children,
}: {
	label: string;
	htmlFor?: string;
	/** Small button next to the name on the right (AI, etc.). */
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex min-h-6 items-center justify-between gap-2">
				<label htmlFor={htmlFor} className="text-cms-muted-foreground text-xs">
					{label}
				</label>
				{action}
			</div>
			{children}
		</div>
	);
}
