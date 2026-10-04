"use client";

import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { X } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Textarea } from "../ui/textarea";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { collapseToEnd, PopoverFormError, PopoverFormFooter, submitOnEnter } from "./link-form";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

/**
 * Input form and popover to add, edit and remove a text decoration that carries one text property (body tooltip `content`, in-code tooltip, etc.).
 * Takes the decoration name and wording and renders them. Shared by the core code block's text tooltip and the blocks extension's body tooltip.
 */

/** Form wording. */
export interface MarkTextLabels {
	/** Decoration name (e.g. `Tooltip`). Used for the button name, the title ("Add Tooltip"/"Edit Tooltip") and the remove button ("Remove Tooltip"). */
	readonly name: string;
	/** Input field name (e.g. `Description`). */
	readonly field: string;
	/** Message when submitting empty (e.g. `Enter a description.`). */
	readonly empty: string;
}

export interface MarkTextFormProps {
	editor: Editor;
	/** Editor mark name. */
	mark: string;
	/** Name of the mark attribute that holds the text. */
	attribute: string;
	labels: MarkTextLabels;
	/** True if the cursor or selection is already inside this decoration. The text can be edited and removed. */
	active: boolean;
	initial: string;
	/** Range of the decoration to edit. If given, this range is edited instead of the current selection (when the cursor is at a decoration boundary in the inline bubble). */
	range?: { from: number; to: number };
	onDone: () => void;
}

/** Decoration text input form. Shared by the formatting tool popover and the inline bubble. */
export function MarkTextForm({ editor, mark, attribute, labels, active, initial, range, onDone }: MarkTextFormProps) {
	const id = useId();
	const [value, setValue] = useState(initial);
	const [error, setError] = useState<string | null>(null);
	const current = () => ({ [attribute]: editor.getAttributes(mark)[attribute] });

	const handleApply = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = value.trim();
		if (!trimmed) {
			setError(labels.empty);
			return;
		}
		const command = editor.chain().focus();
		if (range) command.setTextSelection(range).setMark(mark, { [attribute]: trimmed });
		else if (active) command.extendMarkRange(mark, current()).setMark(mark, { [attribute]: trimmed });
		else command.setMark(mark, { [attribute]: trimmed });
		collapseToEnd(command).run();
		onDone();
	};

	const handleRemove = () => {
		const { from, to } = editor.state.selection;
		const command = editor.chain().focus();
		if (range) command.setTextSelection(range);
		else command.extendMarkRange(mark, current());
		command.unsetMark(mark).setTextSelection({ from, to }).run();
		onDone();
	};

	return (
		<form onSubmit={handleApply} onKeyDown={submitOnEnter} className="grid gap-3">
			<p className="font-medium">
				{active ? t("markText.edit", { name: labels.name }) : t("markText.add", { name: labels.name })}
			</p>
			<label htmlFor={`${id}-content`} className="grid gap-1.5 text-xs">
				{labels.field}
				<Textarea
					id={`${id}-content`}
					value={value}
					rows={2}
					aria-invalid={!!error || undefined}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(event) => {
						setValue(event.target.value);
						setError(null);
					}}
					className="min-h-0"
					autoFocus
				/>
			</label>
			{error && <PopoverFormError id={`${id}-error`}>{error}</PopoverFormError>}
			<PopoverFormFooter
				removeLabel={t("markText.remove", { name: labels.name })}
				removeIcon={<X aria-hidden />}
				onRemove={active ? handleRemove : undefined}
				onCancel={onDone}
			/>
		</form>
	);
}

export interface MarkTextPopoverProps {
	editor: Editor;
	mark: string;
	attribute: string;
	labels: MarkTextLabels;
	icon: ReactNode;
	/** Opens when a window event with this name (`window.dispatchEvent(new CustomEvent(name))`) is received (slash menu, etc.). */
	openEvent?: string;
}

/**
 * Decoration text popover of the formatting tool. Disabled when the selection is empty and not inside a decoration. When the cursor is inside a decoration it is pressed, and the text can be edited or removed.
 * Enter is ignored during Korean IME composition.
 */
export function MarkTextPopover({ editor, mark, attribute, labels, icon, openEvent }: MarkTextPopoverProps) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");

	const isActive = editor.isActive(mark);
	const disabled = !editor.isEditable || (editor.state.selection.empty && !isActive);
	const existing = useCallback(() => String(editor.getAttributes(mark)[attribute] ?? ""), [editor, mark, attribute]);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (disabled && nextOpen) return;
			if (nextOpen) setValue(existing());
			setOpen(nextOpen);
		},
		[disabled, existing],
	);

	useEffect(() => {
		if (!openEvent) return;
		const onOpen = () => {
			if (!editor.isEditable) return;
			if (editor.state.selection.empty && !editor.isActive(mark)) return;
			setValue(existing());
			setOpen(true);
		};
		window.addEventListener(openEvent, onOpen);
		return () => window.removeEventListener(openEvent, onOpen);
	}, [editor, mark, existing, openEvent]);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<Tooltip>
				<TooltipTrigger
					render={
						<PopoverTrigger
							render={
								<Toggle
									size="sm"
									pressed={isActive}
									disabled={disabled}
									aria-label={labels.name}
									onMouseDown={(event) => event.preventDefault()}
									className="size-8 p-0"
								/>
							}
						>
							{icon}
						</PopoverTrigger>
					}
				/>
				<TooltipContent side="bottom">{labels.name}</TooltipContent>
			</Tooltip>
			<PopoverContent align="center" className="w-80 p-3 text-xs">
				<MarkTextForm
					key={String(open)}
					editor={editor}
					mark={mark}
					attribute={attribute}
					labels={labels}
					active={isActive}
					initial={value}
					onDone={() => setOpen(false)}
				/>
			</PopoverContent>
		</Popover>
	);
}
