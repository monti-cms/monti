"use client";

import type {
	BacklinkField,
	Collection,
	ConditionalField,
	LayoutGroup,
	RelationField,
	SlugField,
	ValueField,
	ViewField,
} from "@monti-cms/core/client";
import { type Locale, type SchemaCollection, useSite, useTranslator } from "@monti-cms/core/client";
import { ChevronRight, RefreshCw } from "lucide-react";
import { memo, type ReactNode, useMemo, useState } from "react";
import {
	type FieldInputEntry,
	type FieldInputParts,
	isFieldInputParts,
	useCmsAdminComponents,
} from "../../admin-components";
import { type SlotRequest, useSlot } from "../../slots/slots";
import { Button } from "../../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import { FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet, Field as UiField } from "../../ui/field";
import { Input } from "../../ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../../ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { type EntryForm, recordTranslationKey } from "./entry-form";
import {
	BacklinkInput,
	EntryPicker,
	type FieldInputProps,
	type IncomingReference,
	inputClass,
	multilineProps,
	OrderedEntryList,
} from "./field-inputs";
import { FieldView } from "./field-views";
import { layoutGroupsOf } from "./layout-groups";
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
	/** Do not render this field (when the input lives elsewhere, like the title above the body on the edit screen). */
	omit?: readonly string[];
	/** Whether to show the always-visible description under the field. */
	showDescriptions?: boolean;
	/** Render only this group (splitting per tab in the edit screen's properties panel). All if absent. */
	include?: (group: LayoutGroup) => boolean;
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
	const site = useSite();
	if (slot) {
		return (
			<SlotFieldRow id={id} label={label} required={required} issue={issue} help={help} slot={slot} aside={aside}>
				{children}
			</SlotFieldRow>
		);
	}
	const labelNode = (
		<FieldLabel htmlFor={id} className="font-semibold text-cms-muted-foreground text-xs">
			{label} {required && <span className="text-cms-destructive">*</span>}
		</FieldLabel>
	);
	return (
		<UiField data-invalid={Boolean(issue) || undefined} className="gap-1.5">
			{aside ? (
				<div className="flex min-h-6 items-center justify-between gap-2">
					{labelNode}
					{aside}
				</div>
			) : (
				labelNode
			)}
			{children}
			{issue && <FieldError id={`${id}-error`}>{cmsIssueMessage(site, issue)}</FieldError>}
			{help && <FieldDescription className="text-[11px] leading-tight">{help}</FieldDescription>}
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
	const site = useSite();
	const { trigger, panel } = useSlot(slot);
	return (
		<UiField data-invalid={Boolean(issue) || undefined} className="gap-1.5">
			<div className="flex min-h-6 items-center justify-between gap-2">
				<FieldLabel htmlFor={id} className="font-semibold text-cms-muted-foreground text-xs">
					{label} {required && <span className="text-cms-destructive">*</span>}
				</FieldLabel>
				{aside || trigger ? (
					<span className="flex items-center gap-1">
						{aside}
						{trigger}
					</span>
				) : null}
			</div>
			{children}
			{panel}
			{issue && <FieldError id={`${id}-error`}>{cmsIssueMessage(site, issue)}</FieldError>}
			{help && <FieldDescription className="text-[11px] leading-tight">{help}</FieldDescription>}
		</UiField>
	);
}

/** Relation to a record target (category, tag, collection). Search and pick; with `createInline`, a missing name can be created right from the list. */
function RecordRelationInput({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const t = useTranslator(entriesMessages);
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
				placeholder={relation.placeholder ?? (relation.createInline ? t("relation.searchOrAdd") : t("relation.search"))}
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
								const saved = await creator.create(relation.to as Collection, { title });
								if (!saved) return null;
								records.remember({ ...optionOf(t, saved), status: saved.status });
								return saved.id;
							}
						: undefined
				}
			/>
			{records.error && (
				<p role="alert" className="text-cms-destructive text-xs">
					{t("entry.loadFailed")}
				</p>
			)}
			{creator.sheet}
		</>
	);
}

/** Default input per field kind. If `input` points to a component, render it; otherwise render the input matching the kind. */
function DefaultInput({ parts, ...props }: FieldInputProps & { parts?: FieldInputParts }) {
	const t = useTranslator(entriesMessages);
	const site = useSite();
	const { field, id, value, invalid, describedBy, context, onChange } = props;
	const { fieldInputs } = useCmsAdminComponents();
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
					{...multilineProps(field)}
					autoComplete="off"
					value={text}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
					className="resize-none text-xs md:text-xs"
				/>
			) : (
				<Input
					id={id}
					autoComplete="off"
					value={text}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={placeholder}
					onChange={(event) => onChange(event.target.value)}
					className={inputClass}
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
					<SelectTrigger id={id} size="sm" className="w-full" aria-describedby={describedBy}>
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
	const { fieldInputs } = useCmsAdminComponents();
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
	if (!field.definition || field.hidden) return null;
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
	const store = useEntryFormStore();
	const collection = useEntryFormSelector((state) => state.collection);
	const entryId = useEntryFormSelector((state) => state.entryId);
	const locale = useEntryFormSelector((state) => state.locale);
	const entry = useEntryFormSelector((state) => state.entry);
	const { fieldInputs } = useCmsAdminComponents();
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
	return (
		<FieldRow
			id={field.ids.input}
			label={field.label}
			required={field.required}
			issue={field.error?.issue}
			help={help}
			slot={Input === null ? undefined : (field.slotRequest ?? undefined)}
			aside={Aside ? <Aside {...props} /> : undefined}
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
			<InputGroup className="h-8">
				<InputGroupInput
					id={field.ids.input}
					autoComplete="off"
					aria-invalid={field.inputProps["aria-invalid"]}
					aria-describedby={field.inputProps["aria-describedby"]}
					value={field.value ?? ""}
					onChange={(event) => changeSlug(event.target.value)}
					placeholder={placeholder ?? definition.placeholder}
					className="font-mono text-xs md:text-xs"
				/>
				{onRegenerateSlug && definition.from && (
					<InputGroupAddon align="inline-end">
						<Tooltip>
							<TooltipTrigger
								render={
									<InputGroupButton
										size="icon-xs"
										aria-label={regenerateLabel}
										disabled={field.readOnly}
										onClick={onRegenerateSlug}
									/>
								}
							>
								<RefreshCw aria-hidden />
							</TooltipTrigger>
							<TooltipContent side="bottom">{regenerateLabel}</TooltipContent>
						</Tooltip>
					</InputGroupAddon>
				)}
			</InputGroup>
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
		<div className="space-y-3">
			<ValueRow name={name} showDescriptions={showDescriptions} />
			{Object.keys(nested).map((nestedName) => (
				<ValueRow key={nestedName} name={nestedName} showDescriptions={showDescriptions} />
			))}
		</div>
	);
});

const ViewRow = memo(function ViewRow({ name, showDescriptions }: RowProps) {
	const site = useSite();
	const collection = useEntryFormSelector((state) => state.collection);
	const form = useEntryFormSelector((state) => state.form);
	const entry = useEntryFormSelector((state) => state.entry);
	const field = site.schemaOf(collection).fields[name] as ViewField;
	if (field.hidden) return null;
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
	omit = [],
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
		if (omit.includes(name)) return null;
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

	const groups = layoutGroupsOf(site, collection).filter((group) => !include || include(group));

	return (
		<>
			{groups.map((group, index) => {
				const visible = group.fields.filter((name) => {
					const field = schema.fields[name];
					return field && !omit.includes(name) && !(field.kind !== "conditional" && "hidden" in field && field.hidden);
				});
				if (visible.length === 0) return null;
				const key = `${group.group ?? "group"}-${index}`;
				if (!group.group) {
					return (
						<div key={key} className="space-y-4">
							{visible.map(renderField)}
						</div>
					);
				}
				if (sections === "plain") {
					// If there is only one group (one group in one tab), no title is added.
					if (groups.length === 1) {
						return (
							<div key={key} className="space-y-4">
								{visible.map(renderField)}
							</div>
						);
					}
					return (
						<section key={key} aria-label={group.group} className="space-y-4 border-t pt-4">
							<h3 className="font-medium text-[11px] text-cms-muted-foreground uppercase tracking-wide">
								{group.group}
							</h3>
							{visible.map(renderField)}
						</section>
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
			<FieldSet className="gap-3">
				<FieldLegend variant="label" className="mb-0">
					<CollapsibleTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="-ml-2 font-semibold text-cms-muted-foreground text-xs"
							/>
						}
					>
						<ChevronRight className={`transition-transform ${open ? "rotate-90" : ""}`} />
						{title}
					</CollapsibleTrigger>
				</FieldLegend>
				<CollapsibleContent className="space-y-4">{children}</CollapsibleContent>
			</FieldSet>
		</Collapsible>
	);
}

/**
 * One language's values of a record collection (category, tag, collection). Used by the language tab of the category edit panel.
 * If left empty, that language's page also uses the default language value. Reads the form from the nearest `EntryFormProvider`.
 */
export function RecordLocaleFields({ collection, locale }: { collection: SchemaCollection; locale: Locale }) {
	const site = useSite();
	return (
		<div className="space-y-4">
			{site.recordLocalizedFields(collection).map((name) => (
				<RecordLocaleField key={name} collection={collection} name={name} locale={locale} />
			))}
		</div>
	);
}

function RecordLocaleField({
	collection,
	name,
	locale,
}: {
	collection: SchemaCollection;
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
					{...multilineProps(definition)}
					autoComplete="off"
					lang={locale}
					value={value}
					disabled={field.readOnly}
					onChange={(event) => field.setValue(event.target.value)}
					className="resize-none text-xs md:text-xs"
				/>
			) : (
				<Input
					id={field.ids.input}
					autoComplete="off"
					lang={locale}
					value={value}
					disabled={field.readOnly}
					onChange={(event) => field.setValue(event.target.value)}
					className={inputClass}
				/>
			)}
		</FieldRow>
	);
}
