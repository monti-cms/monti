"use client";

import { ChevronDown, ChevronRight, Renew } from "@carbon/icons-react";
import type {
	BacklinkField,
	ConditionalField,
	RelationField,
	SlugField,
	TextField,
	ValueField,
	ViewField,
} from "@monti-cms/core";
import type { Collection, PanelGroup } from "@monti-cms/core/site";
import {
	bodyExcerpt,
	fillFromBodyLength,
	type Locale,
	type SchemaCollectionName,
	useSite,
	useTranslator,
} from "@monti-cms/core/site";
import {
	Affix,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	FormFieldDescription,
	FormFieldError,
	FormFieldLabel,
	FormFieldLegend,
	FormFieldSet,
	Heading,
	IconButton,
	Inline,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Stack,
	Textarea,
	TextButton,
	FormField as UiField,
} from "@monti-cms/ui";
import { memo, type ReactNode, useMemo, useState } from "react";
import {
	type FieldInputEntry,
	type FieldInputParts,
	isFieldInputParts,
	useAdminComponents,
} from "../../admin-components";
import { type CmsIssue, issueLine } from "../../api/error-message";
import { commonMessages } from "../../lib/common.messages";
import { type SlotRequest, useSlot } from "../../slots/slots";
import { type EntryForm, recordTranslationKey } from "./entry-form";
import {
	BacklinkInput,
	EntryPicker,
	type FieldInputProps,
	type IncomingReference,
	multilineProps,
	OrderedEntryList,
} from "./field-inputs";
import { FieldView } from "./field-views";
import { MediaInput } from "./media-image-input";
import { entriesMessages } from "./messages";
import { optionOf, useRecordCreator } from "./record-create-sheet";
import { RelationCombobox } from "./relation-combobox";
import { type FieldState, useEntryFormSelector, useEntryFormStore, useField } from "./use-field";
import { useRelationSearch } from "./use-relation-search";

/** Usages of the entry the caller already loaded. A backlink input shows them without fetching again. */
export interface SchemaFieldsReferences {
	items: readonly IncomingReference[];
	loading: boolean;
	refresh: () => void;
}

interface SchemaFieldsProps {
	onSlugChange?: (slug: string) => void;
	onRegenerateSlug?: () => void;
	/** Hint text of the slug input. Used when switching to show the value to be generated when empty. */
	slugPlaceholder?: string;
	/** Whether to show the always-visible description under the field. */
	showDescriptions?: boolean;
	/** Render only this group (splitting per tab in the edit screen's properties panel). All if absent. */
	include?: (group: PanelGroup) => boolean;
	/** Group title style. `plain` is a small title that does not collapse (the edit screen's properties panel). */
	sections?: "collapsible" | "plain";
	references?: SchemaFieldsReferences;
}

interface FieldRowProps {
	id: string;
	label: string;
	required?: boolean;
	issue?: CmsIssue;
	help?: ReactNode;
	slot?: SlotRequest;
	/** What goes on the right of the label row (character count, etc.). Comes before the slot button. */
	aside?: ReactNode;
	children: ReactNode;
}

/**
 * Label, required mark, error and help of one field. If `slot` exists, a slot button goes next to the label and the result below the input.
 * All inputs in the properties panel use this row.
 */
export function FieldRow({ id, label, required, issue, help, slot, aside, children }: FieldRowProps) {
	const _site = useSite();
	if (slot) {
		return (
			<SlotFieldRow id={id} label={label} required={required} issue={issue} help={help} slot={slot} aside={aside}>
				{children}
			</SlotFieldRow>
		);
	}
	const labelNode = (
		<FormFieldLabel htmlFor={id} required={required}>
			{label}
		</FormFieldLabel>
	);
	return (
		<UiField data-invalid={Boolean(issue) || undefined}>
			{aside ? (
				<Inline justify="between" gap={8}>
					{labelNode}
					{aside}
				</Inline>
			) : (
				labelNode
			)}
			{help && <FormFieldDescription>{help}</FormFieldDescription>}
			{children}
			{issue && <FormFieldError id={`${id}-error`}>{issueLine(issue)}</FormFieldError>}
		</UiField>
	);
}

function SlotFieldRow({
	id,
	label,
	required,
	issue,
	help,
	slot,
	aside,
	children,
}: FieldRowProps & { slot: SlotRequest }) {
	const _site = useSite();
	const { trigger, panel } = useSlot(slot);
	return (
		<UiField data-invalid={Boolean(issue) || undefined}>
			<Inline justify="between" gap={8}>
				<FormFieldLabel htmlFor={id} required={required}>
					{label}
				</FormFieldLabel>
				{aside || trigger ? (
					<Inline gap={4}>
						{aside}
						{trigger}
					</Inline>
				) : null}
			</Inline>
			{help && <FormFieldDescription>{help}</FormFieldDescription>}
			{children}
			{panel}
			{issue && <FormFieldError id={`${id}-error`}>{issueLine(issue)}</FormFieldError>}
		</UiField>
	);
}

/** Relation to a record target (category, tag, collection). Search and pick; with `createInline`, a missing name can be created right from the list. */
function RecordRelationInput({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	const relation = field as RelationField;
	const selected = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
	// Published records, searched on the server as the user types; the picked ones are looked up by id so they keep their names.
	const records = useRelationSearch({ collection: relation.to, publishedOnly: true, selected });
	const creator = useRecordCreator();
	const options = useMemo(
		() => (records.options ?? []).map((option) => ({ value: option.id, label: option.title })),
		[records.options],
	);
	const known = useMemo(
		() => records.known.map((option) => ({ value: option.id, label: option.title })),
		[records.known],
	);
	return (
		<>
			<RelationCombobox
				id={id}
				multiple={Boolean(relation.many)}
				aria-label={relation.label}
				placeholder={relation.placeholder ?? (relation.createInline ? t("relation.searchOrAdd") : tc("search"))}
				options={options}
				known={known}
				onSearch={records.search}
				loading={records.loading}
				value={selected}
				invalid={invalid}
				describedBy={describedBy}
				disabled={context.disabled}
				onValueChange={(next) => onChange(relation.many ? next : (next[0] ?? null))}
				onCreate={
					relation.createInline
						? async (title) => {
								const saved = await creator.create(relation.to as Collection, title);
								if (!saved) return null;
								records.remember({ ...optionOf(site, tc("untitled"), relation.to, saved), status: saved.status });
								return saved.id;
							}
						: undefined
				}
			/>
			{records.error && <FormFieldError>{t("entry.loadFailed")}</FormFieldError>}
			{creator.sheet}
		</>
	);
}

/** Default input per field kind. If `input` points to a component, render it; otherwise render the input matching the kind. */
function DefaultInput({ parts, ...props }: FieldInputProps & { parts?: FieldInputParts }) {
	const t = useTranslator(entriesMessages);
	const site = useSite();
	const { field, id, value, invalid, describedBy, context, onChange } = props;
	const { fieldInputs } = useAdminComponents();
	const registered = field.input ? fieldInputs?.[field.input] : undefined;
	if (registered && !isFieldInputParts(registered)) {
		const Custom = registered;
		return <Custom {...props} />;
	}
	const text = typeof value === "string" ? value : "";
	const placeholder =
		parts?.placeholder?.(props) ?? (field.kind === "text" || field.kind === "media" ? field.placeholder : undefined);

	switch (field.kind) {
		case "text":
			return field.multiline ? (
				<Textarea
					id={id}
					size="sm"
					{...multilineProps(field)}
					autoComplete="off"
					value={text}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
				/>
			) : (
				<Input
					id={id}
					size="sm"
					autoComplete="off"
					value={text}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
				/>
			);
		case "select": {
			const items = Object.entries(field.options).map(([optionValue, label]) => ({ value: optionValue, label }));
			// A value the site removed from the options is shown as the current value, marked, so it is not replaced silently.
			if (text && !Object.hasOwn(field.options, text)) {
				items.push({ value: text, label: t("select.removedOption", { value: text }) });
			}
			return (
				<Select
					value={text || field.defaultValue}
					items={items}
					disabled={context.disabled}
					onValueChange={(next) => typeof next === "string" && onChange(next)}
				>
					<SelectTrigger id={id} size="sm" width="full" aria-describedby={describedBy}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{items.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);
		}
		case "relation":
			if (site.isItemCollection(field.to)) return <RecordRelationInput {...props} />;
			return field.many ? <OrderedEntryList {...props} /> : <EntryPicker {...props} />;
		case "media":
			return <MediaInput {...props} />;
	}
}

interface RowProps {
	name: string;
	showDescriptions: boolean;
}

/** The entry a site registered under the field's `input` name, if any. */
function useRegisteredInput(field: FieldState): FieldInputEntry | undefined {
	const { fieldInputs } = useAdminComponents();
	const input = field.definition && "input" in field.definition ? field.definition.input : undefined;
	return input ? fieldInputs?.[input] : undefined;
}

/**
 * One value field: label row, default input (or the one a site registered), error, help and slot. It re-renders when its own value, error
 * or read-only state changes. An input a site registered may read the whole form (`FieldInputProps.form`), so only that case
 * subscribes to the form as a whole.
 */
const ValueRow = memo(function ValueRow({ name, showDescriptions }: RowProps) {
	const field = useField(name);
	const registered = useRegisteredInput(field);
	if (!field.definition) return null;
	return registered ? (
		<FormBoundRow field={field} showDescriptions={showDescriptions} />
	) : (
		<ValueRowView field={field} showDescriptions={showDescriptions} />
	);
});

function FormBoundRow({ field, showDescriptions }: { field: FieldState; showDescriptions: boolean }) {
	const locked = field.readOnlyReason === "locked";
	const form = useEntryFormSelector((state) => (locked && state.locked ? state.locked.values : state.form));
	return <ValueRowView field={field} showDescriptions={showDescriptions} form={form} />;
}

function ValueRowView({
	field,
	showDescriptions,
	form,
}: {
	field: FieldState;
	showDescriptions: boolean;
	form?: EntryForm;
}) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const store = useEntryFormStore();
	const collection = useEntryFormSelector((state) => state.collection);
	const entryId = useEntryFormSelector((state) => state.entryId);
	const locale = useEntryFormSelector((state) => state.locale);
	const entry = useEntryFormSelector((state) => state.entry);
	const { fieldInputs } = useAdminComponents();
	const definition = field.definition as ValueField;
	const locked = field.readOnlyReason === "locked";

	const state = store.getState();
	const props: FieldInputProps = {
		collection,
		// Built-in inputs do not read the form, so it is not subscribed to here (`FormBoundRow` does it for a registered input).
		form: form ?? (locked && state.locked ? state.locked.values : state.form),
		name: field.name,
		field: definition,
		id: field.ids.input,
		value: field.value,
		invalid: field.invalid,
		describedBy: field.inputProps["aria-describedby"],
		context: { entryId, locale, groupId: entry?.translationGroupId, disabled: field.readOnly, entry },
		onChange: field.setValue,
	};
	const help = locked ? field.lockedNote : showDescriptions ? field.description : undefined;
	// Input pieces registered by extensions (right of the label row, hint text, input override).
	const registered = definition.input ? fieldInputs?.[definition.input] : undefined;
	const parts = registered && isFieldInputParts(registered) ? registered : undefined;
	const Aside = parts?.Aside;
	const Input = parts?.Input;

	const canFillFromBody =
		definition.kind === "text" && Boolean(definition.fillFromBody) && site.schemaOf(collection).body;

	const fillFromBodyButton = canFillFromBody ? (
		<IconButton
			label={t("field.fillFromBody")}
			side="bottom"
			disabled={field.readOnly}
			onClick={() => {
				const currentDoc = store.getState().form.doc;
				if (!currentDoc) return;
				const length = fillFromBodyLength(definition as TextField);
				const excerpt = bodyExcerpt(site, currentDoc, length);
				field.setValue(excerpt);
			}}
		>
			<Renew aria-hidden />
		</IconButton>
	) : null;

	const aside =
		fillFromBodyButton || Aside ? (
			<Inline gap={4}>
				{fillFromBodyButton}
				{Aside && <Aside {...props} />}
			</Inline>
		) : undefined;

	return (
		<FieldRow
			id={field.ids.input}
			label={field.label}
			required={field.required}
			issue={field.error?.issue}
			help={help}
			slot={Input === null ? undefined : (field.slotRequest ?? undefined)}
			aside={aside}
		>
			{Input === null ? null : Input ? <Input {...props} /> : <DefaultInput {...props} parts={parts} />}
		</FieldRow>
	);
}

const SlugRow = memo(function SlugRow({
	name,
	showDescriptions,
	onSlugChange,
	onRegenerateSlug,
	placeholder,
}: RowProps & {
	onSlugChange?: (slug: string) => void;
	onRegenerateSlug?: () => void;
	placeholder?: string;
}) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const field = useField<string>(name);
	const collection = useEntryFormSelector((state) => state.collection);
	const definition = field.definition as SlugField;
	const changeSlug = onSlugChange ?? field.setValue;
	const request = field.slotRequest;
	const slot = useMemo(
		() => (request ? { ...request, apply: (next: string) => changeSlug(next) } : undefined),
		[request, changeSlug],
	);
	const fromLabel = definition.from
		? (site.schemaOf(collection).fields[definition.from]?.label ?? definition.from)
		: "";
	const regenerateLabel = t("relation.regenerate", { label: fromLabel });
	return (
		<FieldRow
			id={field.ids.input}
			label={field.label}
			required={field.required}
			issue={field.error?.issue}
			help={showDescriptions ? field.description : undefined}
			slot={slot}
		>
			<Affix
				id={field.ids.input}
				autoComplete="off"
				aria-invalid={field.inputProps["aria-invalid"]}
				aria-describedby={field.inputProps["aria-describedby"]}
				value={field.value ?? ""}
				onChange={(event) => changeSlug(event.target.value)}
				placeholder={placeholder ?? definition.placeholder}
				action={
					onRegenerateSlug && definition.from ? (
						<IconButton label={regenerateLabel} side="bottom" disabled={field.readOnly} onClick={onRegenerateSlug}>
							<Renew aria-hidden />
						</IconButton>
					) : undefined
				}
			/>
		</FieldRow>
	);
});

/** A conditional field: its choice, then the fields that belong to the chosen option. */
const ConditionalRow = memo(function ConditionalRow({ name, showDescriptions }: RowProps) {
	const site = useSite();
	const collection = useEntryFormSelector((state) => state.collection);
	const choice = useField<string>(name);
	const field = site.schemaOf(collection).fields[name] as ConditionalField;
	const selected = typeof choice.value === "string" ? choice.value : field.discriminant.defaultValue;
	const nested = field.values[selected] ?? {};
	return (
		<Stack gap={12}>
			<ValueRow name={name} showDescriptions={showDescriptions} />
			{Object.keys(nested).map((nestedName) => (
				<ValueRow key={nestedName} name={nestedName} showDescriptions={showDescriptions} />
			))}
		</Stack>
	);
});

const ViewRow = memo(function ViewRow({ name, showDescriptions }: RowProps) {
	const site = useSite();
	const collection = useEntryFormSelector((state) => state.collection);
	const form = useEntryFormSelector((state) => state.form);
	const entry = useEntryFormSelector((state) => state.entry);
	const field = site.schemaOf(collection).fields[name] as ViewField;
	const view = <FieldView view={field.view} collection={collection} form={form} entry={entry} />;
	return field.label ? (
		<FieldRow id={`cms-${name}`} label={field.label} help={showDescriptions ? field.description : undefined}>
			{view}
		</FieldRow>
	) : (
		view
	);
});

const BacklinkRow = memo(function BacklinkRow({
	name,
	showDescriptions,
	references,
}: RowProps & { references?: SchemaFieldsReferences }) {
	const site = useSite();
	const collection = useEntryFormSelector((state) => state.collection);
	const locked = useEntryFormSelector((state) => state.locked);
	const disabled = useEntryFormSelector((state) => state.disabled);
	const entryId = useEntryFormSelector((state) => state.entryId);
	const groupId = useEntryFormSelector((state) => state.entry?.translationGroupId);
	const field = site.schemaOf(collection).fields[name] as BacklinkField;
	// On a translation, the original's value is only shown (relations point to the original).
	const readOnly = Boolean(locked);
	const targetId = groupId ?? entryId;
	return (
		<FieldRow
			id={`cms-${name}`}
			label={field.label}
			help={locked ? locked.note : showDescriptions ? field.description : undefined}
		>
			<BacklinkInput
				field={field}
				targetId={targetId}
				disabled={disabled || readOnly}
				shared={
					targetId === entryId && references
						? { references: references.items, loading: references.loading, refresh: references.refresh }
						: undefined
				}
			/>
		</FieldRow>
	);
});

/**
 * Reads the collection definition and renders property inputs. Follows the group order of the layout (`layout`),
 * and renders fields not in the layout after the last group in declaration order. For a conditional field, shows its dependent input when the condition holds.
 * The values, issues and read-only state come from the nearest `EntryFormProvider`; each field row reads them with `useField`.
 */
export function SchemaFields({
	onSlugChange,
	onRegenerateSlug,
	slugPlaceholder,
	showDescriptions = true,
	include,
	sections = "collapsible",
	references,
}: SchemaFieldsProps) {
	const site = useSite();
	const store = useEntryFormStore();
	const collection = useEntryFormSelector((state) => state.collection);
	const schema = site.schemaOf(collection);

	const renderField = (name: string) => {
		const field = schema.fields[name];
		if (!field) return null;
		switch (field.kind) {
			case "slug":
				return (
					<SlugRow
						key={name}
						name={name}
						showDescriptions={showDescriptions}
						onSlugChange={onSlugChange}
						onRegenerateSlug={onRegenerateSlug}
						placeholder={slugPlaceholder}
					/>
				);
			case "conditional":
				return <ConditionalRow key={name} name={name} showDescriptions={showDescriptions} />;
			case "view":
				return <ViewRow key={name} name={name} showDescriptions={showDescriptions} />;
			case "backlink":
				return <BacklinkRow key={name} name={name} showDescriptions={showDescriptions} references={references} />;
			default:
				return <ValueRow key={name} name={name} showDescriptions={showDescriptions} />;
		}
	};

	const groups = site.panelGroupsOf(collection).filter((group) => !include || include(group));

	return (
		<>
			{groups.map((group, index) => {
				const visible = group.fields;
				if (visible.length === 0) return null;
				const key = `${group.group ?? "group"}-${index}`;
				if (!group.group) {
					return (
						<Stack key={key} gap={16}>
							{visible.map(renderField)}
						</Stack>
					);
				}
				if (sections === "plain") {
					// If there is only one group (one group in one tab), no title is added.
					if (groups.length === 1) {
						return (
							<Stack key={key} gap={16}>
								{visible.map(renderField)}
							</Stack>
						);
					}
					return (
						<Stack as="section" key={key} aria-label={group.group} gap={16} border="top" paddingTop={16}>
							<Heading as="h3" variant="label">
								{group.group}
							</Heading>
							{visible.map(renderField)}
						</Stack>
					);
				}
				return (
					<LayoutSection
						key={key}
						title={group.group}
						// A group with values or publish problems is not collapsed.
						defaultOpen={() =>
							!group.collapsed ||
							visible.some((name) => {
								const { form, issues } = store.getState();
								const value = form[name];
								return (
									issues.some((issue) => issue.path === name) ||
									(Array.isArray(value) ? value.length > 0 : Boolean(value))
								);
							})
						}
					>
						{visible.map(renderField)}
					</LayoutSection>
				);
			})}
		</>
	);
}

function LayoutSection({
	title,
	defaultOpen,
	children,
}: {
	title: string;
	/** Read once, when the section first renders. */
	defaultOpen: () => boolean;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<FormFieldSet>
				<FormFieldLegend variant="label">
					<CollapsibleTrigger render={<TextButton type="button" />}>
						{open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
						{title}
					</CollapsibleTrigger>
				</FormFieldLegend>
				<CollapsibleContent>
					<Stack gap={16}>{children}</Stack>
				</CollapsibleContent>
			</FormFieldSet>
		</Collapsible>
	);
}

/**
 * One language's values of a record collection (category, tag, collection). Used by the language tab of the category edit panel.
 * If left empty, that language's page also uses the default language value. Reads the form from the nearest `EntryFormProvider`.
 */
export function RecordLocaleFields({ collection, locale }: { collection: SchemaCollectionName; locale: Locale }) {
	const site = useSite();
	return (
		<Stack gap={16}>
			{site.recordLocalizedFields(collection).map((name) => (
				<RecordLocaleField key={name} collection={collection} name={name} locale={locale} />
			))}
		</Stack>
	);
}

function RecordLocaleField({
	collection,
	name,
	locale,
}: {
	collection: SchemaCollectionName;
	name: string;
	locale: Locale;
}) {
	const site = useSite();
	const field = useField<string | null>(recordTranslationKey(name, locale));
	const definition = site.schemaOf(collection).fields[name];
	// The language tab of the category sheet is already visible, so the label is the base field's.
	const label = definition?.label ?? name;
	const multiline = definition?.kind === "text" && definition.multiline;
	const value = typeof field.value === "string" ? field.value : "";
	return (
		<FieldRow id={field.ids.input} label={label}>
			{multiline ? (
				<Textarea
					id={field.ids.input}
					size="sm"
					{...multilineProps(definition)}
					autoComplete="off"
					lang={locale}
					value={value}
					disabled={field.readOnly}
					onChange={(event) => field.setValue(event.target.value)}
				/>
			) : (
				<Input
					id={field.ids.input}
					size="sm"
					autoComplete="off"
					lang={locale}
					value={value}
					disabled={field.readOnly}
					onChange={(event) => field.setValue(event.target.value)}
				/>
			)}
		</FieldRow>
	);
}
