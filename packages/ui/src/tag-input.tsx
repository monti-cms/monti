"use client";

import { type KeyboardEvent, useState } from "react";
import { Chip } from "./chip";
import { cn } from "./cn";

/**
 * A list of short values in one underline field: each value is a `Chip`, and a text entry at the end adds the next one on Enter or a comma
 * (and when the field loses focus). Backspace in the empty entry removes the last chip.
 */
function TagInput({
	items,
	onChange,
	placeholder,
	removeLabel,
	disabled = false,
	mono = false,
	className,
	"aria-label": ariaLabel,
}: {
	items: readonly string[];
	onChange: (items: string[]) => void;
	/** Shown in the entry while there is no chip yet. */
	placeholder?: string;
	/** The accessible name of a chip's remove button. */
	removeLabel: (item: string) => string;
	disabled?: boolean;
	/** Values are code (keys, identifiers). */
	mono?: boolean;
	className?: string;
	"aria-label"?: string;
}) {
	const [input, setInput] = useState("");

	const add = (value: string) => {
		const trimmed = value.trim();
		if (trimmed && !items.includes(trimmed)) onChange([...items, trimmed]);
		setInput("");
	};
	const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		// Korean typing: Enter only finishes the composition.
		if (event.nativeEvent.isComposing || event.key === "Process" || event.keyCode === 229) return;
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			add(input);
		} else if (event.key === "Backspace" && !input && items.length > 0) {
			remove(items.length - 1);
		}
	};

	return (
		<div
			data-slot="tag-input"
			className={cn(
				"flex min-h-monti-control flex-wrap items-center gap-monti-6 border-0 border-monti-default border-b bg-transparent py-monti-4 text-monti-body transition-colors focus-within:border-monti-contrast has-aria-invalid:border-monti-danger",
				mono && "font-mono",
				disabled && "cursor-not-allowed opacity-50",
				className,
			)}
		>
			{items.map((item, index) => (
				<Chip key={item} onRemove={disabled ? undefined : () => remove(index)} removeLabel={removeLabel(item)}>
					<span className="max-w-40 truncate">{item}</span>
				</Chip>
			))}
			{!disabled && (
				<input
					type="text"
					value={input}
					aria-label={ariaLabel}
					placeholder={items.length === 0 ? placeholder : undefined}
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={() => {
						if (input.trim()) add(input);
					}}
					className="h-6 min-w-28 flex-1 bg-transparent px-monti-2 outline-none placeholder:text-monti-faint"
				/>
			)}
		</div>
	);
}

export { TagInput };
