import type { FieldDefinition, StoredField } from "@monti-cms/core";
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
	DragHandle,
	IconButton,
	Input,
	List,
	MenuValue,
	OrderedRow,
	Sortable,
	SortableList,
	Stack,
	Switch,
	Text,
	Textarea,
	useComboboxAnchor,
	useSortableItem,
} from "@monti-cms/ui";
import { Close } from "@monti-cms/ui/icons";
import { type ComponentProps, type ReactNode, useMemo, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { PickOne } from "../settings/pick-one";
import { useRelationField } from "./use-relation-field";

/** A select that holds many values: the picked ones as chips, the input after them to add more. */
function PickMany({
	id,
	items,
	value,
	onChange,
	placeholder,
	readOnly,
	proposal,
}: {
	id: string;
	items: { value: string; label: string }[];
	value: string[];
	onChange: (value: string[]) => void;
	placeholder: string;
	readOnly: boolean;
	/** The value shown is one the assistant proposed and nobody has taken or changed yet. */
	proposal?: boolean;
}) {
	const { t } = useAdmin();
	const anchor = useComboboxAnchor();
	const label = (option: string) => items.find((item) => item.value === option)?.label ?? option;
	return (
		<Combobox
			items={items.map((item) => item.value)}
			multiple
			value={value}
			onValueChange={(next) => onChange(next as string[])}
			itemToStringLabel={(option: string) => label(option)}
			readOnly={readOnly}
		>
			<ComboboxChips ref={anchor} size="md" proposal={proposal}>
				{value.map((option) => (
					// A field that cannot be changed offers no way to take a value out.
					<ComboboxChip key={option} showRemove={!readOnly}>
						{label(option)}
					</ComboboxChip>
				))}
				<ComboboxChipsInput id={id} placeholder={value.length === 0 ? placeholder : undefined} />
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>{t("entry.noOption")}</ComboboxEmpty>
				<ComboboxList>
					{(option: string) => (
						<ComboboxItem key={option} value={option}>
							{label(option)}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

function SortableOrderedRow({
	id,
	label,
	onRemove,
	removeLabel,
	moveLabel,
	proposal,
}: {
	id: string;
	label: string;
	onRemove: () => void;
	removeLabel: string;
	moveLabel: string;
	/** The row is of a value the assistant proposed: its words are blue, as a proposed input's. */
	proposal?: boolean;
}) {
	const item = useSortableItem(id);
	return (
		<OrderedRow
			ref={item.ref}
			handle={<DragHandle {...item.handle} aria-label={moveLabel} />}
			drag={{ ...item.motion, active: item.held }}
			actions={
				<IconButton size="xs" variant="ghost" label={removeLabel} onClick={onRemove}>
					<Close aria-hidden />
				</IconButton>
			}
		>
			<Text tone={proposal ? "proposal" : undefined}>{label}</Text>
		</OrderedRow>
	);
}

function RelationSingleInput({
	id,
	collection,
	field,
	locale,
	entryGroup,
	createMissing,
	offline,
	required,
	value,
	onChange,
	placeholder,
	readOnly,
	proposal,
}: {
	id: string;
	collection: string;
	field: string;
	locale?: string;
	entryGroup?: string;
	createMissing?: boolean;
	/** No candidates are read: the field is drawn as it stands with nothing to pick from (the settings' preview of an unsaved field). */
	offline?: boolean;
	required?: boolean;
	value: string | null;
	onChange: (value: string | null) => void;
	placeholder: string;
	readOnly: boolean;
	/** The value shown is one the assistant proposed and nobody has taken or changed yet. */
	proposal?: boolean;
}) {
	const { t } = useAdmin();
	const rel = useRelationField({ collection, field, locale, entryGroup, createMissing, skip: offline });
	// The input shows the chosen item's name, and what the person types while they type: the search alone would leave it empty.
	const [typing, setTyping] = useState(false);

	const items = useMemo(() => {
		const list = rel.options.map((o) => o.group);
		if (rel.createToken) list.push(rel.createToken);
		return list;
	}, [rel.options, rel.createToken]);

	return (
		<Combobox
			items={items}
			value={value}
			onValueChange={(next) => {
				onChange(next ? String(next) : null);
				rel.setSearch("");
				setTyping(false);
			}}
			// Empty until the options are read: the name is not known before, and the stored id is no name.
			inputValue={typing ? rel.search : value && rel.read.data ? rel.labelOf(value) : ""}
			onInputValueChange={(next) => {
				setTyping(true);
				rel.setSearch(next);
			}}
			onOpenChange={(open) => {
				if (open) return;
				setTyping(false);
				rel.setSearch("");
			}}
			itemToStringLabel={(item) =>
				item === null ? "" : item === rel.createToken ? (rel.createLabel ?? item) : rel.labelOf(item)
			}
			readOnly={readOnly}
		>
			<ComboboxInput
				id={id}
				size="md"
				placeholder={placeholder}
				showClear={!required && Boolean(value)}
				proposal={proposal}
			/>
			<ComboboxContent>
				<ComboboxEmpty>{t("entry.noOption")}</ComboboxEmpty>
				<ComboboxList>
					{(group: string) => {
						const isCreate = group === rel.createToken;
						if (isCreate) {
							return (
								<ComboboxItem key={group} value={group}>
									{rel.createLabel}
								</ComboboxItem>
							);
						}
						const opt = rel.allOptions.find((o) => o.group === group);
						const unpublished = rel.targetKind === "document" && opt && !opt.published;
						const address = rel.addressOf(group);
						return (
							<ComboboxItem key={group} value={group}>
								{rel.labelOf(group)}
								{/* A draft says so at the row's end, as the link card's rows do; a name two options share has its address there (menu.md). */}
								{(unpublished || address) && (
									<MenuValue address={address ?? undefined}>
										{unpublished ? t("relations.unpublished") : null}
									</MenuValue>
								)}
							</ComboboxItem>
						);
					}}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

function RelationManyInput({
	id,
	collection,
	field,
	locale,
	entryGroup,
	createMissing,
	offline,
	value,
	onChange,
	placeholder,
	readOnly,
	proposal,
}: {
	id: string;
	collection: string;
	field: string;
	locale?: string;
	entryGroup?: string;
	createMissing?: boolean;
	/** No candidates are read: the field is drawn as it stands with nothing to pick from (the settings' preview of an unsaved field). */
	offline?: boolean;
	value: string[];
	onChange: (value: string[]) => void;
	placeholder: string;
	readOnly: boolean;
	/** The value shown is one the assistant proposed and nobody has taken or changed yet. */
	proposal?: boolean;
}) {
	const { t } = useAdmin();
	const anchor = useComboboxAnchor();
	const rel = useRelationField({ collection, field, locale, entryGroup, createMissing, skip: offline });

	const items = useMemo(() => {
		const list = rel.options.map((o) => o.group).filter((g) => !value.includes(g));
		if (rel.createToken && !value.includes(rel.createToken)) list.push(rel.createToken);
		return list;
	}, [rel.options, rel.createToken, value]);

	return (
		<Combobox
			items={items}
			multiple
			value={value}
			onValueChange={(next) => {
				onChange(next as string[]);
				rel.setSearch("");
			}}
			inputValue={rel.search}
			onInputValueChange={rel.setSearch}
			itemToStringLabel={(item) =>
				item === null ? "" : item === rel.createToken ? (rel.createLabel ?? item) : rel.labelOf(item)
			}
			readOnly={readOnly}
		>
			<ComboboxChips ref={anchor} size="md" proposal={proposal}>
				{(rel.ready ? value : []).map((item) => (
					// A field that cannot be changed offers no way to take a value out.
					<ComboboxChip key={item} showRemove={!readOnly}>
						{rel.labelOf(item)}
					</ComboboxChip>
				))}
				<ComboboxChipsInput id={id} placeholder={value.length === 0 ? placeholder : undefined} />
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>{t("entry.noOption")}</ComboboxEmpty>
				<ComboboxList>
					{(group: string) => {
						const isCreate = group === rel.createToken;
						if (isCreate) {
							return (
								<ComboboxItem key={group} value={group}>
									{rel.createLabel}
								</ComboboxItem>
							);
						}
						const opt = rel.allOptions.find((o) => o.group === group);
						const unpublished = rel.targetKind === "document" && opt && !opt.published;
						const address = rel.addressOf(group);
						return (
							<ComboboxItem key={group} value={group}>
								{rel.labelOf(group)}
								{/* A draft says so at the row's end, as the link card's rows do; a name two options share has its address there (menu.md). */}
								{(unpublished || address) && (
									<MenuValue address={address ?? undefined}>
										{unpublished ? t("relations.unpublished") : null}
									</MenuValue>
								)}
							</ComboboxItem>
						);
					}}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

function RelationOrderedManyInput({
	id,
	collection,
	field,
	locale,
	entryGroup,
	createMissing,
	offline,
	value,
	onChange,
	placeholder,
	readOnly,
	proposal,
	labelledBy,
}: {
	id: string;
	collection: string;
	field: string;
	locale?: string;
	entryGroup?: string;
	createMissing?: boolean;
	/** No candidates are read: the field is drawn as it stands with nothing to pick from (the settings' preview of an unsaved field). */
	offline?: boolean;
	value: string[];
	onChange: (value: string[]) => void;
	placeholder: string;
	readOnly: boolean;
	/** The value shown is one the assistant proposed and nobody has taken or changed yet. */
	proposal?: boolean;
	/** The label's id: it names the list a read-only field is. */
	labelledBy?: string;
}) {
	const { t } = useAdmin();
	const rel = useRelationField({ collection, field, locale, entryGroup, createMissing, skip: offline });

	const selectableOptions = useMemo(() => {
		const list = rel.options.map((o) => o.group).filter((g) => !value.includes(g));
		if (rel.createToken && !value.includes(rel.createToken)) list.push(rel.createToken);
		return list;
	}, [rel.options, rel.createToken, value]);

	return (
		<Stack gap={8}>
			{/* The input adds an item: a list that is only read has none to add, and the input stands only for an empty value. */}
			{readOnly && value.length > 0 ? null : (
				<Combobox
					items={selectableOptions}
					value={null}
					onValueChange={(next) => {
						if (next) {
							onChange([...value, String(next)]);
							rel.setSearch("");
						}
					}}
					inputValue={rel.search}
					onInputValueChange={rel.setSearch}
					itemToStringLabel={(item) =>
						item === null ? "" : item === rel.createToken ? (rel.createLabel ?? item) : rel.labelOf(item)
					}
					readOnly={readOnly}
				>
					<ComboboxInput id={id} size="md" placeholder={placeholder} showClear={false} proposal={proposal} />
					<ComboboxContent>
						<ComboboxEmpty>{t("entry.noOption")}</ComboboxEmpty>
						<ComboboxList>
							{(group: string) => {
								const isCreate = group === rel.createToken;
								if (isCreate) {
									return (
										<ComboboxItem key={group} value={group}>
											{rel.createLabel}
										</ComboboxItem>
									);
								}
								const opt = rel.allOptions.find((o) => o.group === group);
								const unpublished = rel.targetKind === "document" && opt && !opt.published;
								const address = rel.addressOf(group);
								return (
									<ComboboxItem key={group} value={group}>
										{rel.labelOf(group)}
										{/* A draft says so at the row's end, as the link card's rows do; a name two options share has its address there (menu.md). */}
										{(unpublished || address) && (
											<MenuValue address={address ?? undefined}>
												{unpublished ? t("relations.unpublished") : null}
											</MenuValue>
										)}
									</ComboboxItem>
								);
							}}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
			)}
			{/* Only read: the items in their order, with nothing that moves or removes one (no grip, no ×, no word on how to move). */}
			{value.length > 0 && readOnly && rel.ready && (
				<List marker="none" id={id} aria-labelledby={labelledBy}>
					{value.map((item) => (
						<OrderedRow key={item}>
							<Text>{rel.labelOf(item)}</Text>
						</OrderedRow>
					))}
				</List>
			)}
			{value.length > 0 && !readOnly && rel.ready && (
				<Sortable
					nameOf={(item) => rel.labelOf(String(item))}
					onDrop={({ active, over }) => {
						if (!over) return;
						const from = value.indexOf(String(active.id));
						const to = value.indexOf(String(over.id));
						if (from === -1 || to === -1 || from === to) return;
						const next = [...value];
						const [moved] = next.splice(from, 1);
						if (moved) next.splice(to, 0, moved);
						onChange(next);
					}}
					overlay={(active) => (
						<OrderedRow drag={{ active: true }} handle={<DragHandle aria-hidden tabIndex={-1} />}>
							<Text>{rel.labelOf(String(active.id))}</Text>
						</OrderedRow>
					)}
				>
					<SortableList id={id} items={value}>
						<List marker="none">
							{value.map((item) => (
								<SortableOrderedRow
									key={item}
									id={item}
									label={rel.labelOf(item)}
									moveLabel={t("relations.move", { title: rel.labelOf(item) })}
									removeLabel={t("relations.remove")}
									onRemove={() => onChange(value.filter((g) => g !== item))}
									proposal={proposal}
								/>
							))}
						</List>
					</SortableList>
				</Sortable>
			)}
		</Stack>
	);
}

/** Where a relation field's candidates are read from: the entry's collection and field, in its language. */
export type RelationSource = { collection: string; field: string; locale?: string; entryGroup?: string };

/** A field as the schema defines it, or as an entry stores it (a conditional field is then the choice it is). */
type Definition = FieldDefinition | StoredField;

/** A choice made by a switch (doc 19): one option, on or off. */
export const isToggle = (def: Definition) =>
	(def.kind === "select" || def.kind === "conditional") && "control" in def && def.control === "toggle";

/** The switch of a choice with one option: on holds the option, off holds nothing. */
export function FieldToggle({
	def,
	id,
	value,
	onChange,
	readOnly,
	proposal,
}: {
	def: Definition;
	id: string;
	value: unknown;
	onChange: (value: unknown) => void;
	readOnly: boolean;
	proposal?: boolean;
}) {
	const [on] = def.kind === "select" || def.kind === "conditional" ? def.options : [];
	return (
		<Switch
			id={id}
			checked={on !== undefined && value === on}
			readOnly={readOnly}
			proposal={proposal}
			onCheckedChange={(checked) => onChange(checked ? on : null)}
		/>
	);
}

/**
 * The input of a field by its kind, the one place that says which (collections.md, the preview): the entry editor's property panel and the
 * settings' preview of it both draw their fields with this, so the preview cannot look other than the panel. A text, an address, a choice of
 * one or of many, a related item (one, many, many in an order). A choice made by a switch is {@link FieldToggle}, in a row of its own shape;
 * a media field has its own part in each panel.
 */
export function FieldInput({
	def,
	id,
	value,
	onChange,
	placeholder,
	readOnly,
	proposal,
	optionLabels = {},
	strays = [],
	relation,
	slugAction,
	labelledBy,
	textProps,
}: {
	def: Definition;
	id: string;
	value: unknown;
	onChange: (value: unknown) => void;
	placeholder: string;
	readOnly: boolean;
	/** The value shown is one the assistant proposed and nobody has taken or changed yet. */
	proposal?: boolean;
	/** The options' names, by their stored words. */
	optionLabels?: Record<string, string>;
	/** Stored words the choice no longer lists: shown as they are, after the options. */
	strays?: string[];
	/** Where a related item's candidates are read; `null` reads none (a field that is not saved yet has none to read). */
	relation: RelationSource | null;
	/** The button at the end of the address input. */
	slugAction?: ReactNode;
	/** The id of the field's label, for a value drawn as something a label cannot point at (a read-only list of ordered items). */
	labelledBy?: string;
	/** What the panel adds to a text's input (its focus, for the count). */
	textProps?: Pick<ComponentProps<"input">, "onFocus" | "onBlur">;
}) {
	const { t } = useAdmin();
	// A choice says what it asks for, not that it is empty: an input and a picker are told apart before they are touched.
	// A field nobody can change asks for nothing: it keeps the word for an empty value.
	const choosing = readOnly ? placeholder : t("entry.choose");
	const text = typeof value === "string" ? value : "";
	if (def.kind === "slug")
		return (
			<Input
				id={id}
				size="md"
				mono
				value={text}
				placeholder={placeholder}
				readOnly={readOnly}
				proposal={proposal}
				onChange={(event) => onChange(event.target.value)}
				action={slugAction}
			/>
		);
	if (def.kind === "text")
		return def.multiline ? (
			<Textarea
				id={id}
				size="md"
				value={text}
				placeholder={placeholder}
				maxLength={def.max}
				readOnly={readOnly}
				proposal={proposal}
				onChange={(event) => onChange(event.target.value)}
				{...(textProps as Pick<ComponentProps<"textarea">, "onFocus" | "onBlur">)}
			/>
		) : (
			<Input
				id={id}
				size="md"
				value={text}
				placeholder={placeholder}
				maxLength={def.max}
				readOnly={readOnly}
				proposal={proposal}
				onChange={(event) => onChange(event.target.value)}
				{...textProps}
			/>
		);
	// A conditional field (doc 19) is its choice: the fields of the chosen option are fields of their own, under it.
	if (def.kind === "select" || def.kind === "conditional") {
		// A stored word the field no longer lists (older data, a schema file edited by hand) is shown as it is, never as another option.
		const items = [...def.options, ...strays].map((option) => ({
			value: option,
			label: optionLabels[option] ?? option,
		}));
		return def.kind === "select" && def.many ? (
			<PickMany
				id={id}
				items={items}
				value={Array.isArray(value) ? (value as string[]) : []}
				onChange={onChange}
				placeholder={choosing}
				readOnly={readOnly}
				proposal={proposal}
			/>
		) : (
			<PickOne
				id={id}
				size="md"
				items={items}
				value={typeof value === "string" ? value : null}
				onChange={onChange}
				placeholder={choosing}
				readOnly={readOnly}
				proposal={proposal}
			/>
		);
	}
	if (def.kind === "relation") {
		const shared = {
			id,
			collection: relation?.collection ?? "",
			field: relation?.field ?? "",
			locale: relation?.locale,
			entryGroup: relation?.entryGroup,
			offline: relation === null,
			createMissing: def.createMissing,
			placeholder: choosing,
			readOnly,
			proposal,
		};
		const many = Array.isArray(value) ? (value as string[]) : [];
		if (def.many && def.ordered)
			return <RelationOrderedManyInput {...shared} labelledBy={labelledBy} value={many} onChange={onChange} />;
		if (def.many) return <RelationManyInput {...shared} value={many} onChange={onChange} />;
		return (
			<RelationSingleInput
				{...shared}
				required={def.required}
				value={typeof value === "string" ? value : null}
				onChange={onChange}
			/>
		);
	}
	return null;
}
