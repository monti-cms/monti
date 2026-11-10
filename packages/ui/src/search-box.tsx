"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { type FocusEvent, type KeyboardEvent, useRef, useState } from "react";
import { Button } from "./button";
import { Caret } from "./caret";
import { CHIP_REMOVE } from "./chip";
import { cn } from "./cn";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { Close, Search } from "./icons";
import { useUiLabels } from "./labels";

type SearchTarget<T extends string> = { value: T; label: string };

/**
 * The pill that opens in place of the page's "Search" button. In front, an optional picker: which folders to look in (`scopes`: the open folder, or all of
 * them) and which part of an entry (`targets`: everything, title, address, body), one menu for both, the chip naming what is picked (2026-11-10, owner: no
 * row of its own under the search). Then the magnifier, the words, and a × that clears them. While it is open the filter row does not repeat the words as a chip.
 */
function SearchBox<T extends string = string, S extends string = string>({
	value,
	onValueChange,
	placeholder,
	"aria-label": ariaLabel,
	targets,
	target,
	onTargetChange,
	scopes,
	scope,
	onScopeChange,
	targetLabel,
	autoFocus,
	className,
}: {
	value: string;
	/** Without it the box is drawn and keeps no words. */
	onValueChange?: (value: string) => void;
	placeholder?: string;
	"aria-label": string;
	/** The places to look. Without them there is no picker. */
	targets?: readonly SearchTarget<T>[];
	target?: T;
	onTargetChange?: (target: T) => void;
	/** The folders to look in, the first being where the search starts. Without them the picker has no such group. */
	scopes?: readonly SearchTarget<S>[];
	scope?: S;
	onScopeChange?: (scope: S) => void;
	/** The name of the picker, for screen readers. */
	targetLabel?: string;
	autoFocus?: boolean;
	className?: string;
}) {
	const labels = useUiLabels();
	const field = useRef<HTMLInputElement>(null);
	const current = targets?.find((item) => item.value === target) ?? targets?.[0];
	const place = scopes?.find((item) => item.value === scope) ?? scopes?.[0];
	// The chip names the folder when there is one to pick, and the part of an entry once it is not the first ("everything").
	const named = [place?.label, current && (!place || current !== targets?.[0]) ? current.label : undefined].filter(
		Boolean,
	);
	const picker = named.length > 0;
	return (
		<div
			data-slot="search-box"
			className={cn(
				"flex h-monti-control-lg w-80 min-w-0 max-w-full items-center gap-monti-8 rounded-monti-full bg-monti-muted pr-monti-12 text-monti-default has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-monti-contrast/50",
				picker ? "pl-monti-4" : "pl-monti-12",
				className,
			)}
		>
			{picker && (
				<DropdownMenu>
					<DropdownMenuTrigger
						// The name starts with the visible text (what is now picked), then says what the picker is.
						aria-label={targetLabel ? `${named.join(" · ")}, ${targetLabel}` : undefined}
						className="inline-flex h-monti-control-sm min-w-0 max-w-40 shrink-0 cursor-pointer items-center rounded-monti-full border-0 bg-monti-page pr-monti-8 pl-monti-10 text-monti-default text-monti-note outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50"
					>
						<span className="min-w-0 truncate">{named.join(" · ")}</span>
						<Caret />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{scopes && place && (
							<DropdownMenuRadioGroup value={place.value} onValueChange={(next) => onScopeChange?.(next as S)}>
								{scopes.map((item) => (
									<DropdownMenuRadioItem key={item.value} value={item.value}>
										{item.label}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						)}
						{scopes && place && targets && current && <DropdownMenuSeparator />}
						{targets && current && (
							<DropdownMenuRadioGroup value={current.value} onValueChange={(next) => onTargetChange?.(next as T)}>
								{targets.map((item) => (
									<DropdownMenuRadioItem key={item.value} value={item.value}>
										{item.label}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			<Search aria-hidden className="size-4 shrink-0 text-monti-subtle" />
			<InputPrimitive
				ref={field}
				type="search"
				aria-label={ariaLabel}
				placeholder={placeholder}
				value={value}
				autoFocus={autoFocus}
				onChange={(event) => onValueChange?.(event.target.value)}
				className="min-w-0 flex-1 appearance-none truncate border-0 bg-transparent text-monti-body outline-none placeholder:text-monti-faint [&::-webkit-search-cancel-button]:hidden"
			/>
			{value !== "" && (
				<button
					type="button"
					aria-label={labels.clear}
					// The words go; the box stays, ready for new ones.
					onClick={() => {
						onValueChange?.("");
						field.current?.focus();
					}}
					className={CHIP_REMOVE}
				>
					<Close aria-hidden className="size-4" />
				</button>
			)}
		</div>
	);
}

/**
 * The page's "Search" button (a secondary pill with the magnifier), which opens the {@link SearchBox} in its place, the words' field focused. The box
 * stays while it holds words or has the focus (the × empties it and leaves it open); emptied and left, or emptied and Escape, it is the button again. A
 * press in the box's own picker does not count as leaving.
 */
function SearchToggle<T extends string = string, S extends string = string>({
	label,
	...box
}: Parameters<typeof SearchBox<T, S>>[0] & {
	/** The button's text ("Search"). */
	label: string;
}) {
	const [open, setOpen] = useState(false);
	if (!open && box.value === "") {
		return (
			<Button type="button" variant="secondary" onClick={() => setOpen(true)}>
				<Search aria-hidden />
				{label}
			</Button>
		);
	}
	const leave = (event: FocusEvent<HTMLDivElement>) => {
		const next = event.relatedTarget as Element | null;
		if (next && (event.currentTarget.contains(next) || next.closest("[role=menu]"))) return;
		if (box.value === "") setOpen(false);
	};
	const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape" && box.value === "") setOpen(false);
	};
	return (
		<div
			role="search"
			data-slot="search-toggle"
			className="w-80 max-w-full"
			onFocus={() => setOpen(true)}
			onBlur={leave}
			onKeyDown={closeOnEscape}
		>
			<SearchBox {...box} autoFocus={open || box.autoFocus} />
		</div>
	);
}

export { SearchBox, SearchToggle };
export type { SearchTarget };
