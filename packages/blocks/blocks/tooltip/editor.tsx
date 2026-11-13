"use client";

import type { AdminMarkEditorProps } from "@monti-cms/admin";
import {
	Button,
	FormFieldError,
	Inline,
	Label,
	PopoverHeader,
	PopoverTitle,
	Stack,
	Textarea,
	useBlockLanguage,
} from "@monti-cms/admin/blocks";
import { useId, useState } from "react";
import { words } from "./words";

/**
 * The tooltip card (doc 18, the old block's): its title says whether it adds or edits, a two-line field for the note, and its buttons. Enter (without
 * Shift) puts it on; an empty note puts nothing on. Taking a tooltip off is "clear formatting", as for every format but a link.
 */
export default function TooltipEditor({ attrs, apply }: AdminMarkEditorProps) {
	const language = useBlockLanguage();
	const say = (label: { ko: string; en: string }) => label[language];
	const editing = typeof attrs?.text === "string";
	const [text, setText] = useState(editing ? String(attrs?.text) : "");
	const id = useId();
	const [empty, setEmpty] = useState(false);
	// An empty note is said at the press, under the field; the button stays (a dim button says nothing).
	const put = () => (text.trim() === "" ? setEmpty(true) : apply({ text: text.trim() }));
	return (
		<Stack gap={12}>
			<PopoverHeader>
				<PopoverTitle>{say(editing ? words.edit : words.add)}</PopoverTitle>
			</PopoverHeader>
			<Stack gap={4}>
				<Label htmlFor={id}>{say(words.text)}</Label>
				<Textarea
					id={id}
					size="sm"
					rows={2}
					autoFocus
					value={text}
					aria-invalid={empty || undefined}
					onChange={(event) => {
						setText(event.target.value);
						setEmpty(false);
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
							event.preventDefault();
							put();
						}
					}}
				/>
				{empty && <FormFieldError errors={[{ message: say(words.empty) }]} />}
			</Stack>
			<Inline gap={8} justify="end">
				<Button variant="ghost" size="sm" onClick={() => apply(attrs)}>
					{say(words.cancel)}
				</Button>
				<Button variant="primary" size="sm" onClick={put}>
					{say(editing ? words.saveEdit : words.save)}
				</Button>
			</Inline>
		</Stack>
	);
}
