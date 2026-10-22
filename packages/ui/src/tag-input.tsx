"use client";

import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { cn } from "./cn";

/**
 * A list of short values in one bordered field: each value is a chip, and a text entry at the end adds the next one on Enter or a comma
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
				"flex min-h-control-sm w-full flex-wrap items-center gap-tight rounded-md border border-monti-default bg-monti-page p-tight text-monti-caption transition-colors focus-within:border-monti-focus focus-within:ring-3 focus-within:ring-monti-focus-soft",
				mono && "font-mono",
				disabled && "cursor-not-allowed opacity-50",
				className,
			)}
		>
			{items.map((item, index) => (
				<span
					key={item}
					className="inline-flex items-center gap-tight rounded-sm bg-monti-neutral px-condensed py-hair text-monti-default"
				>
					<span className="max-w-40 truncate">{item}</span>
					{!disabled && (
						<button
							type="button"
							aria-label={removeLabel(item)}
							onClick={() => remove(index)}
							className="rounded-sm text-monti-muted outline-none hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-focus"
						>
							<X className="size-icon-xs" aria-hidden />
						</button>
					)}
				</span>
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
					className="h-6 min-w-28 flex-1 bg-transparent px-tight outline-none placeholder:text-monti-subtle"
				/>
			)}
		</div>
	);
}

export { TagInput };
