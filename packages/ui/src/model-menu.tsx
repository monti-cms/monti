"use client";

import type * as React from "react";
import { Fragment, type ReactElement, type ReactNode, useState } from "react";
import { Caret } from "./caret";
import { cn } from "./cn";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSearch,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { MENU_EMPTY, MenuShortcut, MenuValue } from "./menu-parts";

/** One model of the menu. `value` is what `onValueChange` gets back (a key and a model, as the caller writes them). */
export interface ModelMenuItem {
	readonly value: string;
	/** The model's name, in mono. */
	readonly model: string;
	/** A short word at the end: "default", or the key of a recent model. */
	readonly hint?: ReactNode;
}

/** A group of models: the recent ones, or the models of one key with its name and how many it has. */
export interface ModelMenuGroup {
	readonly key: string;
	readonly label: string;
	readonly count?: number;
	readonly items: readonly ModelMenuItem[];
}

export interface ModelMenuThinking {
	/** The row's name ("Thinking"). */
	readonly label: string;
	readonly value: string;
	readonly options: readonly { readonly value: string; readonly label: string }[];
	readonly onValueChange: (value: string) => void;
}

/**
 * The model menu: a search line ("Find a model"), the models in groups (the recent ones, then one group per key with its count), each in mono with the
 * current one ticked, and, for a model that can think, a "Thinking ›" row at the foot that opens the levels at its side. Typing filters the models by name.
 * `layout="chat"` opens above the chat input's model button, 330px wide; `layout="field"` opens under a field and takes its width.
 */
export function ModelMenu({
	trigger,
	value,
	onValueChange,
	groups,
	searchLabel,
	emptyText,
	thinking,
	layout = "chat",
	open,
	onOpenChange,
}: {
	/** The element that opens it ({@link ModelMenuButton} or {@link MenuField}). */
	trigger: ReactElement;
	value: string | null;
	onValueChange: (value: string) => void;
	groups: readonly ModelMenuGroup[];
	/** The search line's name and placeholder ("Find a model"). */
	searchLabel: string;
	/** What the menu says when no model matches. */
	emptyText: ReactNode;
	/** The thinking levels of the current model. Leave it out for a model that cannot think: the row is not drawn. */
	thinking?: ModelMenuThinking;
	layout?: "chat" | "field";
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();
	const shown = groups
		.map((group) => ({ ...group, items: group.items.filter((item) => item.model.toLowerCase().includes(needle)) }))
		.filter((group) => group.items.length > 0);
	return (
		<DropdownMenu
			{...(open === undefined ? {} : { open })}
			onOpenChange={(next) => {
				if (!next) setQuery("");
				onOpenChange?.(next);
			}}
		>
			<DropdownMenuTrigger render={trigger} />
			<DropdownMenuContent
				side={layout === "chat" ? "top" : "bottom"}
				align={layout === "chat" ? "start" : "end"}
				sideOffset={layout === "chat" ? 8 : 4}
				data-layout={layout}
				className={cn(
					"overflow-visible",
					layout === "chat" ? "w-[330px] min-w-[330px] max-w-[330px]" : "w-(--anchor-width) min-w-(--anchor-width)",
				)}
			>
				<DropdownMenuSearch value={query} onValueChange={setQuery} label={searchLabel} />
				<div
					data-slot="model-menu-scroll"
					className={cn(
						"flex flex-col overflow-y-auto overscroll-contain",
						layout === "chat" ? "max-h-[352px]" : "max-h-[236px]",
					)}
				>
					<DropdownMenuRadioGroup value={value} onValueChange={(next) => onValueChange(next as string)}>
						{shown.map((group, index) => (
							<Fragment key={group.key}>
								{index > 0 && <DropdownMenuSeparator />}
								<DropdownMenuGroup>
									<DropdownMenuLabel>
										{group.label}
										{group.count !== undefined && <span>{group.count}</span>}
									</DropdownMenuLabel>
									{group.items.map((item) => (
										<DropdownMenuRadioItem
											key={`${group.key}:${item.value}`}
											value={item.value}
											className="font-mono text-monti-meta"
										>
											<span className="min-w-0 truncate">{item.model}</span>
											{item.hint && <MenuShortcut>{item.hint}</MenuShortcut>}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuGroup>
							</Fragment>
						))}
					</DropdownMenuRadioGroup>
					{shown.length === 0 && <p className={cn("m-0", MENU_EMPTY)}>{emptyText}</p>}
				</div>
				{thinking && (
					<>
						<DropdownMenuSeparator className="first:block last:block" />
						<DropdownMenuSub>
							<DropdownMenuSubTrigger className="text-monti-default">
								{thinking.label}
								<MenuValue>{thinking.options.find((option) => option.value === thinking.value)?.label}</MenuValue>
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent side="left" align="end" alignOffset={-7} className="w-40 min-w-40">
								<DropdownMenuRadioGroup
									value={thinking.value}
									onValueChange={(next) => thinking.onValueChange(next as string)}
								>
									{thinking.options.map((option) => (
										<DropdownMenuRadioItem key={option.value} value={option.value}>
											{option.label}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The model button at the start of the chat input's row: the model in mono, its thinking level after a dot when it thinks ("· thinking high"), and a caret.
 * Subtle at rest; ink while its menu is open.
 */
export function ModelMenuButton({
	model,
	thinking,
	label,
	...props
}: Omit<React.ComponentProps<"button">, "children" | "className" | "style"> & {
	model: string;
	/** The level, worded ("thinking high"). Leave it out for a model that cannot think. */
	thinking?: string;
	/** The button's name for screen readers ("Choose model"). */
	label: string;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			data-slot="model-menu-button"
			className="flex min-w-0 items-center gap-monti-6 border-0 bg-transparent p-0 font-mono text-monti-meta text-monti-subtle outline-none hover:text-monti-default focus-visible:text-monti-default aria-expanded:text-monti-default"
			{...props}
		>
			<span className="min-w-0 truncate">{model}</span>
			{thinking && <span className="shrink-0 text-monti-faint">· {thinking}</span>}
			<Caret solo className="size-3.5 shrink-0" />
		</button>
	);
}

/**
 * A value picked from a menu, drawn as a field (the quick-task model, a plugin's key): an underline with the value (in mono with `mono`), a quieter
 * `meta` after it (the key of a model, the last characters of a key), and a caret. Without a value it shows `placeholder`, faint, or in the warning ink
 * with `warning` (a key a plugin still needs). It opens a menu, or a dialog when there is nothing to pick yet.
 */
export function MenuField({
	value,
	meta,
	mono = false,
	placeholder,
	warning = false,
	...props
}: Omit<React.ComponentProps<"button">, "children" | "className" | "style" | "value"> & {
	value?: ReactNode;
	meta?: ReactNode;
	mono?: boolean;
	placeholder?: ReactNode;
	warning?: boolean;
}) {
	const empty = value === undefined || value === null || value === "";
	return (
		<button
			type="button"
			data-slot="menu-field"
			data-warning={(empty && warning) || undefined}
			className="flex w-full items-center justify-between gap-monti-8 rounded-none border-0 border-monti-default border-b bg-transparent py-monti-6 text-left text-monti-default text-monti-note outline-none transition-colors focus-visible:border-monti-contrast disabled:text-monti-faint aria-expanded:border-monti-contrast data-warning:text-monti-warning"
			{...props}
		>
			<span className="flex min-w-0 items-baseline gap-monti-6">
				{empty ? (
					<span className={cn(!warning && "text-monti-faint")}>{placeholder}</span>
				) : (
					<>
						<span className={cn("truncate", mono && "font-mono")}>{value}</span>
						{meta && <span className="shrink-0 font-mono text-monti-meta text-monti-subtle">{meta}</span>}
					</>
				)}
			</span>
			<Caret solo className="size-3.5 shrink-0" />
		</button>
	);
}
