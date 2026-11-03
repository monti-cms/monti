"use client";

import type * as React from "react";
import { useState } from "react";
import { cn } from "./cn";
import { View, ViewOff } from "./icons";
import { Input } from "./input";
import { TextButton } from "./text-button";

/**
 * A value typed hidden (an API key): one underline holding the input and a 24px eye that shows what was just typed until it is pressed again. There is
 * no clear ×; a saved value is never shown again (that is a {@link SavedValue}). `keep` ends the line with a quiet text button that goes back to the
 * saved value ("Keep"). The underline turns ink while the input has focus, danger when `aria-invalid`.
 */
function SecretInput({
	showLabel,
	hideLabel,
	keep,
	...props
}: Omit<React.ComponentProps<"input">, "type" | "className" | "style" | "size" | "width"> & {
	/** The eye's name while the value is hidden ("Show key") and while it shows ("Hide key"). */
	showLabel: string;
	hideLabel: string;
	/** A text button at the end of the line, back to the saved value. */
	keep?: { label: string; onClick: () => void };
}) {
	const [shown, setShown] = useState(false);
	return (
		<span
			data-slot="secret-input"
			className={cn(
				"flex items-center gap-monti-4 border-monti-default border-b focus-within:border-monti-contrast",
				props["aria-invalid"] && "border-monti-danger focus-within:border-monti-danger",
			)}
		>
			<Input
				{...props}
				type={shown ? "text" : "password"}
				mono
				autoComplete="off"
				spellCheck={false}
				className="border-b-0"
			/>
			<button
				type="button"
				aria-label={shown ? hideLabel : showLabel}
				aria-pressed={shown}
				onClick={() => setShown((value) => !value)}
				className="flex size-6 shrink-0 items-center justify-center rounded-monti-sm border-0 bg-transparent p-0 text-monti-subtle outline-none hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20 [&_svg]:size-4"
			>
				{shown ? <ViewOff aria-hidden /> : <View aria-hidden />}
			</button>
			{keep && (
				<TextButton type="button" variant="quiet" size="note" className="ml-monti-8" onClick={keep.onClick}>
					{keep.label}
				</TextButton>
			)}
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
			className="flex h-[33px] items-center gap-monti-12 border-transparent border-b py-monti-6"
		>
			<span className="min-w-0 flex-1 truncate font-mono text-monti-body">{children}</span>
			<TextButton type="button" variant="underline" size="note" onClick={action.onClick}>
				{action.label}
			</TextButton>
		</span>
	);
}

export { SavedValue, SecretInput };
