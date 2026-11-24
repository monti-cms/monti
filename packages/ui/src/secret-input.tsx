"use client";

import type * as React from "react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { View, ViewOff } from "./icons";
import { Input } from "./input";
import { TextButton } from "./text-button";

/**
 * A value typed hidden (an API key, a password): one underline field holding the input and, at its end, the eye (an icon button one size under the
 * field) that shows what was just typed until it is pressed again. There is no clear ×; a saved value is never shown again (that is a
 * {@link SavedValue}). `keep` ends the line with a quiet text button that goes back to the saved value ("Keep"). The underline turns ink while the
 * input has focus, danger when `aria-invalid`. A key is mono and keeps the browser's autofill out; `kind="password"` is in the body font and lets the
 * browser's password manager fill it (give it `autoComplete`). `peek` shows the value it opens with by its start and end with dots between
 * ("sk-ant-api03-••••Q2a"), so the person can tell which key a check refused; the first key typed, pasted or deleted in it starts a new value.
 */
function SecretInput({
	showLabel,
	hideLabel,
	keep,
	kind = "key",
	autoComplete,
	peek,
	...props
}: Omit<React.ComponentProps<"input">, "type" | "className" | "style" | "size" | "width"> & {
	/** How many characters of the value's start and end show while it is hidden, until it is edited. */
	peek?: { start: number; end: number };
	/** `key` (the default): mono, no autofill. `password`: the body font, and the `autoComplete` it is given. */
	kind?: "key" | "password";
	/** The eye's name while the value is hidden ("Show key") and while it shows ("Hide key"). */
	showLabel: string;
	hideLabel: string;
	/** A text button at the end of the line, back to the saved value. */
	keep?: { label: string; onClick: () => void };
}) {
	const [shown, setShown] = useState(false);
	// Held here when it is not held from outside, so the field can show dots in its place and the value again.
	const [own, setOwn] = useState(String(props.defaultValue ?? ""));
	const held = props.value !== undefined;
	const opening = held ? String(props.value) : own;
	const [peeking, setPeeking] = useState(peek !== undefined && opening.length > peek.start + peek.end);
	const masked = peeking && !shown ? peek : undefined;
	// While it peeks the field holds dots, not the value: what is typed, pasted or deleted is not applied to them but starts a new value, sent
	// as the field's own change once it holds the value again.
	const startOver = (input: HTMLInputElement, next: string) => {
		flushSync(() => setPeeking(false));
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, next);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	};
	const peekProps: Pick<
		React.ComponentProps<"input">,
		"value" | "onChange" | "onBeforeInput" | "onKeyDown" | "onPaste"
	> = masked
		? {
				value: `${opening.slice(0, masked.start)}${"•".repeat(16)}${opening.slice(-masked.end)}`,
				onChange: () => {},
				onBeforeInput: (event) => {
					event.preventDefault();
					startOver(event.currentTarget, event.data ?? "");
				},
				onKeyDown: (event) => {
					props.onKeyDown?.(event);
					if (event.key !== "Backspace" && event.key !== "Delete") return;
					event.preventDefault();
					startOver(event.currentTarget, "");
				},
				onPaste: (event) => {
					props.onPaste?.(event);
					event.preventDefault();
					startOver(event.currentTarget, event.clipboardData.getData("text"));
				},
			}
		: {};
	// One field: the input with the eye (and "keep") as its action, so the tint covers the whole line and the eye sits inside it.
	return (
		<span data-slot="secret-input" className="block">
			<Input
				{...props}
				value={held ? props.value : own}
				defaultValue={undefined}
				onChange={(event) => {
					if (!held) setOwn(event.target.value);
					props.onChange?.(event);
				}}
				{...peekProps}
				type={shown || masked ? "text" : "password"}
				mono={kind === "key"}
				autoComplete={kind === "key" ? "off" : autoComplete}
				spellCheck={false}
				action={
					<span className="flex items-center gap-monti-4">
						{keep && (
							<TextButton type="button" variant="quiet" size="note" onClick={keep.onClick}>
								{keep.label}
							</TextButton>
						)}
						{/* Not a pressed toggle: the icon and the name already say which way it is, so it keeps no background while shown. */}
						<IconButton label={shown ? hideLabel : showLabel} onClick={() => setShown((value) => !value)}>
							{shown ? <ViewOff aria-hidden /> : <View aria-hidden />}
						</IconButton>
					</span>
				}
			/>
		</span>
	);
}

/**
 * A saved value shown, not typed ("··· a1b2"), with one text action at its end ("Change"). It is as tall as an input and its text sits where typed text
 * will, so nothing moves when the action opens a {@link SecretInput} in its place. It has no visible underline: it is not a field.
 */
function SavedValue({
	children,
	action,
}: {
	children: React.ReactNode;
	action: { label: string; onClick: () => void };
}) {
	return (
		<span
			data-slot="saved-value"
			className="flex h-monti-control-md items-center gap-monti-12 border-transparent border-b"
		>
			<span className="min-w-0 flex-1 truncate font-mono text-monti-body">{children}</span>
			<Button type="button" variant="ghost" size="sm" onClick={action.onClick}>
				{action.label}
			</Button>
		</span>
	);
}

export { SavedValue, SecretInput };
