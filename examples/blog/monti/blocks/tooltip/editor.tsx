"use client";

import type { AdminMarkEditorProps } from "@monti-cms/admin";
import {
	Button,
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
	const put = () => (text.trim() === "" ? apply(attrs) : apply({ text: text.trim() }));
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
					placeholder={say(words.placeholder)}
					onChange={(event) => setText(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
							event.preventDefault();
							put();
						}
					}}
				/>
			</Stack>
			<Inline gap={8} justify="end">
				<Button variant="ghost" size="sm" onClick={() => apply(attrs)}>
					{say(words.cancel)}
				</Button>
				<Button variant="primary" size="sm" disabled={text.trim() === ""} onClick={put}>
					{say(editing ? words.saveEdit : words.save)}
				</Button>
			</Inline>
		</Stack>
	);
}
