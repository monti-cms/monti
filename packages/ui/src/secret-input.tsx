"use client";

import type * as React from "react";
import { useState } from "react";
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
 * browser's password manager fill it (give it `autoComplete`).
 */
function SecretInput({
	showLabel,
	hideLabel,
	keep,
	kind = "key",
	autoComplete,
	...props
}: Omit<React.ComponentProps<"input">, "type" | "className" | "style" | "size" | "width"> & {
	/** `key` (the default): mono, no autofill. `password`: the body font, and the `autoComplete` it is given. */
	kind?: "key" | "password";
	/** The eye's name while the value is hidden ("Show key") and while it shows ("Hide key"). */
	showLabel: string;
	hideLabel: string;
	/** A text button at the end of the line, back to the saved value. */
	keep?: { label: string; onClick: () => void };
}) {
	const [shown, setShown] = useState(false);
	// One field: the input with the eye (and "keep") as its action, so the tint covers the whole line and the eye sits inside it.
	return (
		<span data-slot="secret-input" className="block">
			<Input
				{...props}
				type={shown ? "text" : "password"}
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
						<IconButton
							label={shown ? hideLabel : showLabel}
							pressed={shown}
							onClick={() => setShown((value) => !value)}
						>
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
			className="flex h-monti-control-lg items-center gap-monti-12 border-transparent border-b"
		>
			<span className="min-w-0 flex-1 truncate font-mono text-monti-body">{children}</span>
			<Button type="button" variant="ghost" size="sm" onClick={action.onClick}>
				{action.label}
			</Button>
		</span>
	);
}

export { SavedValue, SecretInput };
