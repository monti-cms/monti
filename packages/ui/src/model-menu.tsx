"use client";

import type * as React from "react";
import { Fragment, type ReactElement, type ReactNode, useState } from "react";
import { Button } from "./button";
import { Caret } from "./caret";
import { cn } from "./cn";
import { CutWords } from "./cut-words";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSearch,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { MENU_EMPTY, MenuShortcut } from "./menu-parts";
import { SELECT_TRIGGER } from "./select";

/** One model of the menu. `value` is what `onValueChange` gets back (a key and a model, as the caller writes them). */
export interface ModelMenuItem {
	readonly value: string;
	/** The model's name as a person reads it ("Claude Sonnet 5.5"), in the menu's own text. */
	readonly model: string;
	/** The id its service knows it by ("anthropic/claude-sonnet-5.5"): a search finds it by this too. */
	readonly id?: string;
	/** The row's tooltip: what the row cannot say in a line (its id, the model an alias stands for). */
	readonly title?: string;
	/** Short words at the end: "default", or the key of a recent model. */
	readonly hint?: ReactNode;
}

/** A group of models: the recent ones, or the models of one key with its name and how many it has. */
export interface ModelMenuGroup {
	readonly key: string;
	readonly label: string;
	readonly count?: number;
	readonly items: readonly ModelMenuItem[];
}

/**
 * The model menu: a search line ("Find a model"), the models in groups (the recent ones, then one group per key with its count), each by its name with
 * the current one ticked. Typing filters the models by name or id. How hard a model thinks is not here: {@link ThinkingMenu} stands beside the button.
 * `layout="chat"` opens above the chat input's model button, 330px wide; `layout="field"` opens under a field and takes its width.
 */
export function ModelMenu({
	trigger,
	value,
	onValueChange,
	groups,
	searchLabel,
	emptyText,
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
	layout?: "chat" | "field";
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();
	// While a search filters the models, a group's count is the models it found there, not all the key has (ST-32).
	const shown = groups
		.map((group) => {
			const items = group.items.filter(
				(item) => item.model.toLowerCase().includes(needle) || (item.id?.toLowerCase().includes(needle) ?? false),
			);
			return { ...group, items, count: group.count !== undefined && needle !== "" ? items.length : group.count };
		})
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
										<DropdownMenuRadioItem key={`${group.key}:${item.value}`} value={item.value} title={item.title}>
											<CutWords className="min-w-0 truncate">{item.model}</CutWords>
											{item.hint && <MenuShortcut>{item.hint}</MenuShortcut>}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuGroup>
							</Fragment>
						))}
					</DropdownMenuRadioGroup>
					{shown.length === 0 && <p className={cn("m-0", MENU_EMPTY)}>{emptyText}</p>}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * The model button at the start of the chat input's row: the model's name and a caret. Subtle at rest; ink while its menu is open. Short of room the
 * name is cut with "…" (its whole name in its tooltip), before anything after it in the row gives way.
 */
export function ModelMenuButton({
	model,
	label,
	...props
}: Omit<React.ComponentProps<"button">, "children" | "className" | "style"> & {
	model: string;
	/** The button's name for screen readers ("Choose model"). */
	label: string;
}) {
	return (
		// A small ghost button pulled 4px into the box's padding: its ground sits 8px from the box's edge on the left as at the bottom, and the caret side is 6px, as tight as the words side looks.
		<Button
			variant="ghost"
			size="sm"
			aria-label={label}
			data-slot="model-menu-button"
			className="-ml-monti-4 min-w-0 max-w-full shrink pr-monti-6 pl-monti-10 text-monti-subtle"
			{...props}
		>
			{/* A name cut short is said whole in a tooltip, as every cut line is (not the browser's `title`, which a button does not get). */}
			<CutWords>{model}</CutWords>
			<Caret solo />
		</Button>
	);
}

/**
 * How hard the model thinks, beside the model button: a small ghost button in its look with the level in words ("Thinking medium") and a caret,
 * opening the levels the model takes above it. Drawn only for a model that thinks. It keeps its width: the model's name gives way first.
 */
export function ThinkingMenu({
	value,
	options,
	onValueChange,
	label,
	text,
}: {
	value: string;
	/** The levels the model takes, worded. */
	options: readonly { readonly value: string; readonly label: string }[];
	onValueChange: (value: string) => void;
	/** The menu's head ("Thinking"). The button is named by its words (`text`), which carry the level. */
	label: string;
	/** The button's words: the current level ("Thinking medium"). */
	text: string;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="sm"
						// Its words are its name ("Thinking medium"): a screen reader hears the level, as the eye reads it.
						data-slot="thinking-menu-button"
						className="pr-monti-6 pl-monti-10 text-monti-subtle"
					>
						{text}
						<Caret solo />
					</Button>
				}
			/>
			<DropdownMenuContent side="top" align="start" sideOffset={8} className="w-40 min-w-40">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{label}</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={value} onValueChange={(next) => onValueChange(next as string)}>
						{options.map((option) => (
							<DropdownMenuRadioItem key={option.value} value={option.value}>
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * A value picked from a menu, drawn as a field in the look of a closed `SelectTrigger` (the quick-task model, a plugin's key): an underline with the value (in mono with `mono`), a quieter
 * `meta` after it (the key of a model, in words; with `metaMono`, the last characters of a key), and a caret. Short of room the meta gives way
 * first and is cut, then the value: nothing leaves the field. Without a value it shows `placeholder`, faint, or in the warning ink
 * with `warning` (a key a plugin still needs). It opens a menu, or a dialog when there is nothing to pick yet.
 */
export function MenuField({
	value,
	meta,
	mono = false,
	metaMono = false,
	placeholder,
	warning = false,
	size = "sm",
	...props
}: Omit<React.ComponentProps<"button">, "children" | "className" | "style" | "value"> & {
	value?: ReactNode;
	meta?: ReactNode;
	mono?: boolean;
	/** The meta is written as it is typed or copied (a key's last characters): mono. A name a person gave stays in sans. */
	metaMono?: boolean;
	placeholder?: ReactNode;
	warning?: boolean;
	/** As a `SelectTrigger`'s: `sm` (note text, the default: a settings row) or `default` (body text, beside a form's inputs). */
	size?: "sm" | "md" | "default";
}) {
	const empty = value === undefined || value === null || value === "";
	return (
		<button
			type="button"
			data-slot="menu-field"
			data-size={size}
			data-warning={(empty && warning) || undefined}
			className={cn(SELECT_TRIGGER, "w-full data-warning:text-monti-warning")}
			{...props}
		>
			<span className="flex min-w-0 items-baseline gap-monti-6">
				{empty ? (
					<span className={cn(!warning && "text-monti-faint")}>{placeholder}</span>
				) : (
					<>
						{/* The value does not give way at all while a meta can (a part of a pixel short and its end would turn into "…"); alone, it is cut at the field's width. */}
						<CutWords className={cn("max-w-full shrink-0", mono && "font-mono")}>{value}</CutWords>
						{meta && (
							<CutWords
								className={cn(
									"min-w-0 truncate text-monti-subtle",
									metaMono ? "font-mono text-monti-caption" : "text-monti-caption",
								)}
							>
								{meta}
							</CutWords>
						)}
					</>
				)}
			</span>
			<Caret solo className="size-3.5 shrink-0" />
		</button>
	);
}
