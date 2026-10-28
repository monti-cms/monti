"use client";

import { Close } from "@carbon/icons-react";
import { useTranslator } from "@monti-cms/core/site";
import { Label, Stack, Text, Textarea } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import { type FormEvent, useId, useState } from "react";
import { collapseToEnd, PopoverFormError, PopoverFormFooter, submitOnEnter } from "./link-form";
import { editorMessages } from "./messages";

/**
 * Input form to add, edit and remove a text decoration that carries one text property (body tooltip `content`, in-code tooltip, etc.).
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
	const t = useTranslator(editorMessages);
	const id = useId();
	const [value, setValue] = useState(initial);
	const [error, setError] = useState<string | null>(null);
	const current = () => ({ [attribute]: editor.getAttributes(mark)[attribute] });

	const handleApply = (event: FormEvent<HTMLElement>) => {
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
		<Stack as="form" gap={12} onSubmit={handleApply} onKeyDown={submitOnEnter}>
			<Text as="p" weight="medium">
				{active ? t("markText.edit", { name: labels.name }) : t("markText.add", { name: labels.name })}
			</Text>
			<Stack gap={8}>
				<Label htmlFor={`${id}-content`} size="caption">
					{labels.field}
				</Label>
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
					autoFocus
				/>
			</Stack>
			{error && <PopoverFormError id={`${id}-error`}>{error}</PopoverFormError>}
			<PopoverFormFooter
				removeLabel={t("markText.remove", { name: labels.name })}
				removeIcon={<Close aria-hidden />}
				onRemove={active ? handleRemove : undefined}
				onCancel={onDone}
			/>
		</Stack>
	);
}
