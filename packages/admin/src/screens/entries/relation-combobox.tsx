"use client";

import { useTranslator } from "@monti-cms/core/client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../lib/utils/cn";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from "../../ui/combobox";
import { entriesMessages } from "./messages";

export interface RelationOption {
	value: string;
	label: string;
}

/** The `Add 'query'` item at the end of the list. The query is the name itself, so it always passes the filter. */
type Item = RelationOption & { create?: true };

interface RelationComboboxProps {
	options: readonly RelationOption[];
	multiple: boolean;
	/** Picked IDs. For a single-pick relation, empty or one. */
	value: readonly string[];
	onValueChange: (value: string[]) => void;
	/** If present, a new item can be added from the search query. Returns the created item's ID, or null if cancelled. */
	onCreate?: (label: string) => Promise<string | null>;
	id?: string;
	placeholder?: string;
	"aria-label"?: string;
	invalid?: boolean;
	describedBy?: string;
	disabled?: boolean;
	/** For multiple, whether to show picked items as chips inside the input. Turn off where the picked list is drawn separately (collection post list). */
	showChips?: boolean;
}

/**
 * Relation input such as tags and categories. Search and pick; for a name that does not exist, `Add 'name'` at the end of the list opens the add sheet
 * (no separate "new item" input row).
 */
export function RelationCombobox({
	options,
	multiple,
	value,
	onValueChange,
	onCreate,
	id,
	placeholder,
	"aria-label": ariaLabel,
	invalid,
	describedBy,
	disabled,
	showChips = true,
}: RelationComboboxProps) {
	const t = useTranslator(entriesMessages);
	const anchor = useComboboxAnchor();
	const [query, setQuery] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const byValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
	// A selected value not yet in the list (e.g. just created) is shown by a short ID instead of a name. Base UI resets
	// the input text to the picked name when the value object changes, so pass the same object for the same selection.
	const valueKey = value.join("\u0000");
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the joined ids
	const selected: Item[] = useMemo(
		() => value.map((item) => byValue.get(item) ?? { value: item, label: item.slice(0, 8) }),
		[valueKey, byValue],
	);

	const trimmed = query.trim();
	const canCreate =
		Boolean(onCreate) &&
		!isCreating &&
		trimmed !== "" &&
		// Do not create if the picked item's name is shown in the input (single-pick relation) or the name already exists.
		![...options, ...selected].some((option) => option.label.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
	const items: Item[] = canCreate
		? [...options, { value: `__create__:${trimmed}`, label: trimmed, create: true }]
		: [...options];

	const create = async (label: string, keep: string[]) => {
		if (!onCreate) return;
		setIsCreating(true);
		setError(null);
		try {
			const createdId = await onCreate(label);
			if (createdId === null) return;
			onValueChange([...keep, createdId]);
			setQuery("");
		} catch (caught) {
			setError(caught instanceof Error && caught.message ? caught.message : t("relation.addFailed"));
		} finally {
			setIsCreating(false);
		}
	};

	const list = (
		<ComboboxContent anchor={multiple ? anchor : undefined}>
			<ComboboxEmpty>{t("relation.empty")}</ComboboxEmpty>
			<ComboboxList>
				{(item: Item) => (
					<ComboboxItem key={item.value} value={item} className={cn(item.create && "text-cms-primary")}>
						{item.create ? (
							<>
								<Plus aria-hidden />
								<span className="truncate">{t("relation.create", { label: item.label })}</span>
							</>
						) : (
							<span className="truncate">{item.label}</span>
						)}
					</ComboboxItem>
				)}
			</ComboboxList>
		</ComboboxContent>
	);

	const errorText = error && (
		<p role="alert" className="text-cms-destructive text-xs">
			{error}
		</p>
	);

	if (multiple) {
		return (
			<>
				<Combobox
					items={items}
					multiple
					autoHighlight
					disabled={disabled || isCreating}
					value={selected}
					onValueChange={(next: Item[]) => {
						const created = next.find((item) => item.create);
						const keep = next.filter((item) => !item.create).map((item) => item.value);
						if (created) void create(created.label, keep);
						else onValueChange(keep);
					}}
					onInputValueChange={setQuery}
					itemToStringLabel={(item: Item) => item.label}
					isItemEqualToValue={(a: Item, b: Item) => a.value === b.value}
				>
					<ComboboxChips ref={anchor} className="w-full min-w-0">
						<ComboboxValue>
							{(showChips ? selected : []).map((item) => (
								<ComboboxChip key={item.value} className="max-w-full">
									<span className="truncate">{item.label}</span>
								</ComboboxChip>
							))}
						</ComboboxValue>
						<ComboboxChipsInput
							id={id}
							aria-label={ariaLabel}
							aria-invalid={invalid || undefined}
							aria-describedby={describedBy}
							placeholder={selected.length === 0 || !showChips ? placeholder : undefined}
							className="text-xs"
						/>
					</ComboboxChips>
					{list}
				</Combobox>
				{errorText}
			</>
		);
	}

	return (
		<>
			<Combobox
				items={items}
				autoHighlight
				disabled={disabled || isCreating}
				value={selected[0] ?? null}
				onValueChange={(next: Item | null) => {
					if (next?.create) void create(next.label, []);
					else onValueChange(next ? [next.value] : []);
				}}
				onInputValueChange={setQuery}
				itemToStringLabel={(item: Item) => item.label}
				isItemEqualToValue={(a: Item, b: Item) => a.value === b.value}
			>
				<ComboboxInput
					id={id}
					aria-label={ariaLabel}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={placeholder}
					showClear={selected.length > 0}
					disabled={disabled || isCreating}
					className="h-8 w-full text-xs [&_input]:text-xs"
				/>
				{list}
			</Combobox>
			{errorText}
		</>
	);
}
