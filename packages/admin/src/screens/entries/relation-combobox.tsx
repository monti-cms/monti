"use client";

import { Add } from "@carbon/icons-react";
import { useTranslator } from "@monti-cms/core/site";
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
	FormFieldError,
	Text,
	useComboboxAnchor,
} from "@monti-cms/ui";
import { useMemo, useRef, useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { EmptyState } from "../shared/empty-state";
import { entriesMessages } from "./messages";
import { usePropertyEdit } from "./property-edit";

export interface RelationOption {
	value: string;
	label: string;
}

/** The `Add 'query'` item at the end of the list. The query is the name itself, so it always passes the filter. */
type Item = RelationOption & { create?: true };

interface RelationComboboxProps {
	/** The choices. With `onSearch` these are what the server found for the typed text, shown as they are (not filtered again here). */
	options: readonly RelationOption[];
	/**
	 * Names of values that may not be among `options` (the picked ones, when the options are a search result). Used to label picked values.
	 */
	known?: readonly RelationOption[];
	/**
	 * Called with the typed text (and with the empty text when the list closes), so the options can come from a server search.
	 * Turns off the filtering done here: the options are already the matches.
	 */
	onSearch?: (query: string) => void;
	/** The options for the latest text are on their way. Shown in place of "No matches". */
	loading?: boolean;
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
	known,
	onSearch,
	loading = false,
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
	const tc = useTranslator(commonMessages);
	const anchor = useComboboxAnchor();
	// Opened in place in the properties list: the list is open at once, and closing it ends the edit.
	const edit = usePropertyEdit();
	const [query, setQuery] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	// A name being added opens a sheet: the list closing then does not end the edit, or the sheet would go with it.
	const creating = useRef(false);
	const [error, setError] = useState<string | null>(null);

	const byValue = useMemo(
		() => new Map([...(known ?? []), ...options].map((option) => [option.value, option])),
		[options, known],
	);
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
	/** Typing asks the server again; so does clearing the text. Picking an item only puts its name in the input, which is not a new search. */
	const searchProps = onSearch
		? {
				filter: null,
				onInputValueChange: (text: string, details: { reason: string }) => {
					setQuery(text);
					if (
						details.reason === "input-change" ||
						details.reason === "input-clear" ||
						details.reason === "clear-press"
					) {
						onSearch(text);
					}
				},
				// A closed list starts the next search from the first entries again.
				onOpenChange: (open: boolean) => {
					if (!open) {
						onSearch("");
						if (!creating.current) edit?.done();
					}
				},
			}
		: {
				onInputValueChange: setQuery,
				onOpenChange: (open: boolean) => {
					if (!open && !creating.current) edit?.done();
				},
			};
	const openProps = edit ? { defaultOpen: true } : {};
	const items: Item[] = canCreate
		? [...options, { value: `__create__:${trimmed}`, label: trimmed, create: true }]
		: [...options];

	const create = async (label: string, keep: string[]) => {
		if (!onCreate) return;
		setIsCreating(true);
		creating.current = true;
		setError(null);
		try {
			const createdId = await onCreate(label);
			if (createdId === null) return;
			onValueChange([...keep, createdId]);
			setQuery("");
		} catch (caught) {
			setError(caught instanceof Error && caught.message ? caught.message : t("relation.addFailed"));
		} finally {
			creating.current = false;
			setIsCreating(false);
		}
	};

	const list = (
		<ComboboxContent anchor={multiple ? anchor : undefined}>
			<ComboboxEmpty>
				<EmptyState compact title={loading ? tc("loading") : t("relation.empty")} />
			</ComboboxEmpty>
			<ComboboxList>
				{(item: Item) => (
					<ComboboxItem key={item.value} value={item}>
						{item.create ? (
							<>
								<Add aria-hidden />
								<Text truncate>{t("relation.create", { label: item.label })}</Text>
							</>
						) : (
							<Text truncate>{item.label}</Text>
						)}
					</ComboboxItem>
				)}
			</ComboboxList>
		</ComboboxContent>
	);

	const errorText = error && <FormFieldError>{error}</FormFieldError>;

	if (multiple) {
		return (
			<>
				<Combobox
					items={items}
					multiple
					autoHighlight
					{...openProps}
					disabled={disabled || isCreating}
					value={selected}
					onValueChange={(next: Item[]) => {
						const created = next.find((item) => item.create);
						const keep = next.filter((item) => !item.create).map((item) => item.value);
						if (created) void create(created.label, keep);
						else onValueChange(keep);
					}}
					{...searchProps}
					itemToStringLabel={(item: Item) => item.label}
					isItemEqualToValue={(a: Item, b: Item) => a.value === b.value}
				>
					<ComboboxChips ref={anchor}>
						<ComboboxValue>
							{(showChips ? selected : []).map((item) => (
								<ComboboxChip key={item.value}>
									<Text truncate>{item.label}</Text>
								</ComboboxChip>
							))}
						</ComboboxValue>
						<ComboboxChipsInput
							id={id}
							aria-label={ariaLabel}
							aria-invalid={invalid || undefined}
							aria-describedby={describedBy}
							placeholder={selected.length === 0 || !showChips ? placeholder : undefined}
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
				{...openProps}
				disabled={disabled || isCreating}
				value={selected[0] ?? null}
				onValueChange={(next: Item | null) => {
					if (next?.create) void create(next.label, []);
					else onValueChange(next ? [next.value] : []);
				}}
				{...searchProps}
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
					size="sm"
				/>
				{list}
			</Combobox>
			{errorText}
		</>
	);
}
