"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { Search, X } from "lucide-react";
import { Caret } from "./caret";
import { cn } from "./cn";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { useUiLabels } from "./labels";

type SearchTarget<T extends string> = { value: T; label: string };

/**
 * The pill that opens in place of the page's "Search" button. In front, an optional picker for where to look (everything, title, address,
 * body); then the magnifier, the words, and a × that clears them. While it is open the filter row does not repeat the words as a chip.
 */
function SearchBox<T extends string = string>({
	value,
	onValueChange,
	placeholder,
	"aria-label": ariaLabel,
	targets,
	target,
	onTargetChange,
	targetLabel,
	autoFocus,
	className,
}: {
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	"aria-label": string;
	/** The places to look. Without them there is no picker. */
	targets?: readonly SearchTarget<T>[];
	target?: T;
	onTargetChange?: (target: T) => void;
	/** The name of the picker, for screen readers. */
	targetLabel?: string;
	autoFocus?: boolean;
	className?: string;
}) {
	const labels = useUiLabels();
	const current = targets?.find((item) => item.value === target) ?? targets?.[0];
	return (
		<div
			data-slot="search-box"
			className={cn(
				"flex h-monti-control w-full max-w-80 items-center gap-monti-8 rounded-monti-full bg-monti-muted pr-monti-12 text-monti-default focus-within:ring-2 focus-within:ring-monti-contrast/20",
				targets && current ? "pl-monti-4" : "pl-monti-12",
				className,
			)}
		>
			{targets && current && (
				<DropdownMenu>
					<DropdownMenuTrigger
						// The name starts with the visible text (the place now picked), then says what the picker is.
						aria-label={targetLabel ? `${current.label}, ${targetLabel}` : undefined}
						className="inline-flex h-monti-control-sm shrink-0 cursor-pointer items-center rounded-monti-full border-0 bg-monti-page pr-monti-8 pb-[2px] pl-monti-10 text-monti-default text-monti-note outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/20"
					>
						{current.label}
						<Caret />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuRadioGroup value={current.value} onValueChange={(next) => onTargetChange?.(next as T)}>
							{targets.map((item) => (
								<DropdownMenuRadioItem key={item.value} value={item.value}>
									{item.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			<Search aria-hidden className="size-4 shrink-0 text-monti-subtle" />
			<InputPrimitive
				type="search"
				aria-label={ariaLabel}
				placeholder={placeholder}
				value={value}
				autoFocus={autoFocus}
				onChange={(event) => onValueChange(event.target.value)}
				className="min-w-0 flex-1 appearance-none truncate border-0 bg-transparent text-monti-body outline-none placeholder:text-monti-faint [&::-webkit-search-cancel-button]:hidden"
			/>
			{value !== "" && (
				<button
					type="button"
					aria-label={labels.clear}
					onClick={() => onValueChange("")}
					className="flex shrink-0 cursor-pointer border-0 bg-transparent p-0 text-monti-subtle outline-none hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20"
				>
					<X aria-hidden className="size-4" />
				</button>
			)}
		</div>
	);
}

export { SearchBox };
export type { SearchTarget };
