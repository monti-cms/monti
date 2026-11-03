"use client";

import { Renew } from "@carbon/icons-react";
import type {
	BacklinkField,
	ConditionalField,
	RelationField,
	SlugField,
	TextField,
	ValueField,
	ViewField,
} from "@monti-cms/core";
import type { PanelGroup } from "@monti-cms/core/site";
import { bodyExcerpt, fillFromBodyLength, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Affix,
	FormField,
	FormFieldDescription,
	FormFieldError,
	FormFieldLabel,
	IconButton,
	Inline,
	PropertyGroup,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { type FocusEvent, memo, type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { type FieldInputEntry, isFieldInputParts } from "../../admin-components";
import { getEntry } from "../../api/entries";
import { fieldIssueLine } from "../../api/error-message";
import { FIELD_PROPOSAL_ATTRIBUTE } from "../../editor/proposals/use-proposal-marks";
import { commonMessages } from "../../lib/common.messages";
import { type SlotRequest, SlotScope } from "../../slots/slots";
import { type BacklinkChange, backlinkChangeTo, backlinkShown } from "./backlink-changes";
import type { EntryData } from "./entry-form";
import {
	BacklinkInput,
	backlinkMembers,
	type FieldInputProps,
	type IncomingReference,
	useWrittenPick,
} from "./field-inputs";
import { useFieldProposals } from "./field-proposals";
import { FieldView } from "./field-views";
import { MediaValue } from "./media-image-input";
import { entriesMessages } from "./messages";
import { PropertyEditContext, usePropertyEdit } from "./property-edit";
import { optionOf } from "./record-create-sheet";
import { DefaultInput, useRegisteredInput } from "./schema-fields";
import { type FieldState, useEntryFormSelector, useEntryFormStore, useField } from "./use-field";
import { useRelationSearch } from "./use-relation-search";

interface FocusRequest {
	/** The field the page asked to bring up (a publish problem). */
	path: string | null;
	onFocused: () => void;
}

/** Usages of the entry the caller already loaded. A backlink row reads its members from them without fetching again. */
export interface SchemaFieldsReferences {
	items: readonly IncomingReference[];
	loading: boolean;
	refresh: () => Promise<void> | void;
}

interface ShellProps {
	/** The field name, as the page names it for a jump to a publish problem. */
	name: string;
	controlId: string;
	label: string;
	/** The value as text, for a property that cannot be changed here. */
	display: ReactNode;
	isEmpty: boolean;
	/** The input, there from the start. `null`: the property is only read. */
	editor: ReactNode | null;
	/** The assistant wrote or proposes the value and nobody has edited it. */
	assisted: boolean;
	readOnly: boolean;
	note?: ReactNode;
	issue?: Parameters<typeof fieldIssueLine>[0];
	errorId?: string;
	/** On the label row while the input has the focus: a count, a piece an extension added. */
	extras?: ReactNode;
	slot?: SlotRequest | null;
	focus: FocusRequest;
}

/** One property: the label with its actions over the input itself (or the value as text when it cannot be changed here). */
function PropertyShell({
	name,
	controlId,
	label,
	display,
	isEmpty,
	editor,
	assisted,
	readOnly,
	note,
	issue,
	errorId,
	extras,
	slot,
	focus,
}: ShellProps) {
	const [focused, setFocused] = useState(false);
	const labelId = useId();
	const jump = focus.path === name;
	useEffect(() => {
		if (!jump) return;
		document.getElementById(controlId)?.focus();
		focus.onFocused();
	}, [jump, controlId, focus.onFocused]);
	const edit = useMemo(() => ({ proposal: assisted }), [assisted]);
	const editable = !readOnly && editor !== null;
	const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
	}, []);
	const row = (trigger: ReactNode, failure: ReactNode) => (
		<FormField aria-labelledby={labelId} onFocus={() => setFocused(true)} onBlur={onBlur}>
			<FormFieldLabel
				id={labelId}
				htmlFor={editable ? controlId : undefined}
				action={
					(focused && extras) || trigger ? (
						<Inline gap={8}>
							{focused && extras}
							{trigger}
						</Inline>
					) : undefined
				}
			>
				{label}
			</FormFieldLabel>
			{editable ? (
				<PropertyEditContext.Provider value={edit}>{editor}</PropertyEditContext.Provider>
			) : (
				<Text variant="note" tone={isEmpty ? "faint" : assisted ? "proposal" : "default"} preserveLines>
					{display}
				</Text>
			)}
			{note && <FormFieldDescription>{note}</FormFieldDescription>}
			{issue ? <FormFieldError id={errorId}>{fieldIssueLine(issue)}</FormFieldError> : failure}
		</FormField>
	);
	return slot ? <SlotScope request={slot}>{({ trigger, panel }) => row(trigger, panel)}</SlotScope> : row(null, null);
}

const isBlank = (value: unknown): boolean =>
	value == null || (typeof value === "string" ? value.trim() === "" : Array.isArray(value) && value.length === 0);

/** The names of the entries a relation holds, looked up by id: "React · Frontend". */
function RelationNames({ relation, ids }: { relation: RelationField; ids: readonly string[] }) {
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	const site = useSite();
	const search = useRelationSearch({ collection: relation.to, selected: ids, search: false });
	const target = site.isCollection(relation.to) ? site.schemaOf(relation.to).label : relation.to;
	return (
		<>
			{ids
				.map(
					(id) => search.entryOf(id)?.title ?? (search.isMissing(id) ? t("entry.missing", { target }) : tc("loading")),
				)
				.join(" · ")}
		</>
	);
}

/** A value field at rest, by kind. */
function ValueDisplay({ field, value }: { field: ValueField; value: FieldInputProps["value"] }) {
	const t = useTranslator(entriesMessages);
	const text = typeof value === "string" ? value : "";
	switch (field.kind) {
		case "select": {
			// A value the site removed from the options is shown as the current value, marked, so it is not replaced silently.
			if (text && !Object.hasOwn(field.options, text)) return <>{t("select.removedOption", { value: text })}</>;
			const choice = text && Object.hasOwn(field.options, text) ? text : field.defaultValue;
			return <>{field.options[choice] ?? text}</>;
		}
		case "relation": {
			const ids = Array.isArray(value) ? value : text ? [text] : [];
			return <RelationNames relation={field} ids={ids} />;
		}
		case "media":
			return <MediaValue mediaId={text} accept={field.accept} />;
		default:
			return <>{text}</>;
	}
}

/** The kinds that always have a value to read: a select reads its default. */
const alwaysHasValue = (field: ValueField) => field.kind === "select";

/** The counter that ends a text field's label row while it is open: characters of the most it takes. */
function Counter({ length, max }: { length: number; max: number }) {
	return (
		<Text variant="micro" tone={length > max ? "danger" : "subtle"}>
			{length} / {max}
		</Text>
	);
}

const ValueProperty = memo(function ValueProperty({ name, focus }: { name: string; focus: FocusRequest }) {
	const field = useField(name);
	const registered = useRegisteredInput(field);
	if (!field.definition || field.definition.kind === "slug") return null;
	return registered ? (
		<FormBoundProperty field={field} registered={registered} focus={focus} />
	) : (
		<ValuePropertyView field={field} registered={undefined} focus={focus} />
	);
});

function FormBoundProperty({
	field,
	registered,
	focus,
}: {
	field: FieldState;
	registered: FieldInputEntry;
	focus: FocusRequest;
}) {
	const locked = field.readOnlyReason === "locked";
	const form = useEntryFormSelector((state) => (locked && state.locked ? state.locked.values : state.form));
	return <ValuePropertyView field={field} registered={registered} focus={focus} form={form} />;
}

function ValuePropertyView({
	field,
	registered,
	form,
	focus,
}: {
	field: FieldState;
	registered: FieldInputEntry | undefined;
	form?: FieldInputProps["form"];
	focus: FocusRequest;
}) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const store = useEntryFormStore();
	const collection = useEntryFormSelector((state) => state.collection);
	const entryId = useEntryFormSelector((state) => state.entryId);
	const locale = useEntryFormSelector((state) => state.locale);
	const entry = useEntryFormSelector((state) => state.entry);
	const definition = field.definition as ValueField;
	const locked = field.readOnlyReason === "locked";
	const state = store.getState();
	// A proposed value waits in the input itself, in the assistant's blue; typing into it takes it first, as the person's edit.
	const proposal = useFieldProposals().byField.get(field.name);
	const props: FieldInputProps = {
		collection,
		form: form ?? (locked && state.locked ? state.locked.values : state.form),
		name: field.name,
		field: definition,
		id: field.ids.input,
		value: proposal ? (proposal.value as FieldInputProps["value"]) : field.value,
		invalid: field.invalid,
		describedBy: field.inputProps["aria-describedby"],
		context: { entryId, locale, groupId: entry?.translationGroupId, disabled: field.readOnly, entry },
		onChange: proposal
			? (next) => {
					proposal.accept();
					field.setValue(next);
				}
			: field.setValue,
	};
	const parts = registered && isFieldInputParts(registered) ? registered : undefined;
	const Aside = parts?.Aside;
	const Empty = parts?.Empty;
	const Input = parts?.Input;
	const empty = !proposal && isBlank(field.value) && !alwaysHasValue(definition);
	const canFillFromBody =
		definition.kind === "text" && Boolean(definition.fillFromBody) && site.schemaOf(collection).body;
	const max = definition.kind === "text" ? definition.max : undefined;
	const length = typeof field.value === "string" ? field.value.length : 0;

	const extras = (
		<>
			{canFillFromBody && (
				<TextButton
					type="button"
					aria-label={t("field.fillFromBody")}
					disabled={field.readOnly}
					onClick={() => {
						const currentDoc = store.getState().form.doc;
						if (!currentDoc) return;
						field.setValue(bodyExcerpt(site, currentDoc, fillFromBodyLength(definition as TextField)));
					}}
				>
					{t("field.fromBody")}
				</TextButton>
			)}
			{Aside ? <Aside {...props} /> : max ? <Counter length={length} max={max} /> : null}
		</>
	);

	return (
		<PropertyShell
			name={field.name}
			controlId={field.ids.input}
			label={field.label}
			isEmpty={empty}
			display={
				empty ? (
					Empty ? (
						<Empty {...props} />
					) : (
						t("property.empty")
					)
				) : (
					<ValueDisplay field={definition} value={field.value} />
				)
			}
			editor={
				Input === null ? null : (
					<div {...(proposal ? { [FIELD_PROPOSAL_ATTRIBUTE]: field.name } : {})}>
						{Input ? <Input {...props} /> : <DefaultInput {...props} parts={parts} />}
					</div>
				)
			}
			assisted={field.assisted || Boolean(proposal)}
			readOnly={field.readOnly}
			note={locked ? field.lockedNote : undefined}
			issue={field.error?.issue}
			errorId={field.ids.error}
			extras={extras}
			slot={Input === null ? undefined : field.slotRequest}
			focus={focus}
		/>
	);
}

const SlugProperty = memo(function SlugProperty({
	name,
	focus,
	onSlugChange,
	onRegenerateSlug,
}: {
	name: string;
	focus: FocusRequest;
	onSlugChange?: (slug: string) => void;
	onRegenerateSlug?: () => void;
}) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const field = useField<string>(name);
	const collection = useEntryFormSelector((state) => state.collection);
	const definition = field.definition as SlugField;
	const changeSlug = onSlugChange ?? field.setValue;
	const request = field.slotRequest;
	const slot = useMemo(
		() => (request ? { ...request, apply: (next: string) => changeSlug(next) } : null),
		[request, changeSlug],
	);
	const fromLabel = definition.from
		? (site.schemaOf(collection).fields[definition.from]?.label ?? definition.from)
		: "";
	const slug = field.value ?? "";
	return (
		<PropertyShell
			name={name}
			controlId={field.ids.input}
			label={field.label}
			isEmpty={!slug}
			display={
				slug ? (
					<Text as="span" variant="meta">
						/{slug}
					</Text>
				) : definition.from ? (
					t("property.slugFromTitle")
				) : (
					t("property.empty")
				)
			}
			editor={
				<SlugAffix
					field={field}
					placeholder={definition.placeholder}
					onChange={changeSlug}
					onRegenerate={onRegenerateSlug && definition.from ? onRegenerateSlug : undefined}
					regenerateLabel={t("relation.regenerate", { label: fromLabel })}
				/>
			}
			assisted={field.assisted}
			readOnly={field.readOnly}
			issue={field.error?.issue}
			errorId={field.ids.error}
			slot={slot}
			focus={focus}
		/>
	);
});

function SlugAffix({
	field,
	placeholder,
	onChange,
	onRegenerate,
	regenerateLabel,
}: {
	field: FieldState<string>;
	placeholder?: string;
	onChange: (slug: string) => void;
	onRegenerate?: () => void;
	regenerateLabel: string;
}) {
	const edit = usePropertyEdit();
	return (
		<Affix
			id={field.ids.input}
			autoComplete="off"
			proposal={edit?.proposal}
			aria-invalid={field.inputProps["aria-invalid"]}
			aria-describedby={field.inputProps["aria-describedby"]}
			value={field.value ?? ""}
			onChange={(event) => onChange(event.target.value)}
			placeholder={placeholder}
			action={
				onRegenerate ? (
					<IconButton label={regenerateLabel} side="bottom" disabled={field.readOnly} onClick={onRegenerate}>
						<Renew aria-hidden />
					</IconButton>
				) : undefined
			}
		/>
	);
}

const ConditionalProperty = memo(function ConditionalProperty({ name, focus }: { name: string; focus: FocusRequest }) {
	const site = useSite();
	const collection = useEntryFormSelector((state) => state.collection);
	const choice = useField<string>(name);
	const field = site.schemaOf(collection).fields[name] as ConditionalField;
	const selected = typeof choice.value === "string" ? choice.value : field.discriminant.defaultValue;
	const nested = field.values[selected] ?? {};
	return (
		<>
			<ValueProperty name={name} focus={focus} />
			{Object.keys(nested).map((nestedName) => (
				<ValueProperty key={nestedName} name={nestedName} focus={focus} />
			))}
		</>
	);
});

const ViewProperty = memo(function ViewProperty({ name }: { name: string }) {
	const site = useSite();
	const collection = useEntryFormSelector((state) => state.collection);
	const form = useEntryFormSelector((state) => state.form);
	const entry = useEntryFormSelector((state) => state.entry);
	const field = site.schemaOf(collection).fields[name] as ViewField;
	const view = <FieldView view={field.view} collection={collection} form={form} entry={entry} />;
	const labelId = useId();
	return field.label ? (
		<FormField aria-labelledby={labelId}>
			<FormFieldLabel id={labelId}>{field.label}</FormFieldLabel>
			{view}
		</FormField>
	) : (
		view
	);
});

const BacklinkProperty = memo(function BacklinkProperty({
	name,
	references,
	focus,
}: {
	name: string;
	references?: SchemaFieldsReferences;
	focus: FocusRequest;
}) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	const store = useEntryFormStore();
	const collection = useEntryFormSelector((state) => state.collection);
	const locked = useEntryFormSelector((state) => state.locked);
	const disabled = useEntryFormSelector((state) => state.disabled);
	const entryId = useEntryFormSelector((state) => state.entryId);
	const groupId = useEntryFormSelector((state) => state.entry?.translationGroupId);
	const backlinks = useEntryFormSelector((state) => state.backlinks);
	const field = site.schemaOf(collection).fields[name] as BacklinkField;
	const marked = useField(name);
	// On a translation, the original's value is only shown (relations point to the original).
	const targetId = groupId ?? entryId;
	const shared = targetId === entryId && references ? references : undefined;
	// The properties list stays while the input opens and closes, so it is the one that reads the usages again after the save wrote a pick.
	const change = useWrittenPick(
		backlinks && { change: backlinks.changes[name], error: backlinks.errors[name] },
		shared?.refresh,
	);
	const server = shared ? backlinkMembers(shared.items, field, tc("untitled")) : [];
	const names = backlinkShown(server, change).map((member) => member.title);
	const set = backlinks?.set;
	const pick = useMemo(
		() =>
			set
				? { change, error: backlinks.errors[name], set: (next: BacklinkChange | null) => set(name, next) }
				: undefined,
		[backlinks, set, change, name],
	);
	// The assistant picks a series: like a pick of the person's, the post's save writes it, and the row reads it in the assistant's blue until it is changed.
	const request = marked.slotRequest;
	const serverKey = server.map((member) => member.id).join(",");
	// biome-ignore lint/correctness/useExhaustiveDependencies: `server` is keyed by its ids
	const slot = useMemo(
		() =>
			request && targetId && set
				? {
						...request,
						filled: names.length > 0,
						apply: async (id: string) => {
							const record = await getEntry<EntryData>(site, id);
							const titles = new Map(backlinkShown(server, change).map((member) => [member.id, member.title]));
							titles.set(id, optionOf(site, tc("untitled"), field.from, record).title);
							set(
								name,
								backlinkChangeTo(server, [...titles.keys()], (picked) => titles.get(picked) ?? tc("untitled")),
							);
							store.getState().setAssisted(name, true);
						},
					}
				: null,
		[request, targetId, set, names.length, serverKey, change, site, field, tc, store, name],
	);
	return (
		<PropertyShell
			name={name}
			controlId={`cms-${name}`}
			label={field.label}
			isEmpty={names.length === 0}
			display={names.length > 0 ? names.join(" · ") : t("property.none")}
			editor={
				<BacklinkInput
					id={`cms-${name}`}
					field={field}
					targetId={targetId}
					disabled={disabled || Boolean(locked)}
					shared={shared ? { references: shared.items, loading: shared.loading, refresh: shared.refresh } : undefined}
					pick={pick}
					onChange={() => store.getState().setAssisted(name, false)}
				/>
			}
			assisted={marked.assisted}
			readOnly={disabled || Boolean(locked)}
			note={locked ? locked.note : undefined}
			slot={slot}
			focus={focus}
		/>
	);
});

interface PropertyFieldsProps {
	/** Render only the groups of this tab. */
	include: (group: PanelGroup) => boolean;
	references?: SchemaFieldsReferences;
	onSlugChange?: (slug: string) => void;
	onRegenerateSlug?: () => void;
	/** The field the page asks to bring up, and the call that says it was. */
	focusPath?: string | null;
	onFocused?: () => void;
}

/**
 * The properties of the entry, in the order of the collection's layout: a group with a name gets its quiet subheading, and every field is a
 * row with its input there from the start. The values, issues and read-only state come from the nearest `EntryFormProvider`.
 */
export function PropertyFields({
	include,
	references,
	onSlugChange,
	onRegenerateSlug,
	focusPath = null,
	onFocused,
}: PropertyFieldsProps) {
	const site = useSite();
	const collection = useEntryFormSelector((state) => state.collection);
	const schema = site.schemaOf(collection);
	const onDone = useCallback(() => onFocused?.(), [onFocused]);
	const focus = useMemo(() => ({ path: focusPath, onFocused: onDone }), [focusPath, onDone]);

	const renderField = (name: string): ReactNode => {
		const field = schema.fields[name];
		if (!field) return null;
		switch (field.kind) {
			case "slug":
				return (
					<SlugProperty
						key={name}
						name={name}
						focus={focus}
						onSlugChange={onSlugChange}
						onRegenerateSlug={onRegenerateSlug}
					/>
				);
			case "conditional":
				return <ConditionalProperty key={name} name={name} focus={focus} />;
			case "view":
				return <ViewProperty key={name} name={name} />;
			case "backlink":
				return <BacklinkProperty key={name} name={name} references={references} focus={focus} />;
			default:
				return <ValueProperty key={name} name={name} focus={focus} />;
		}
	};

	const groups = site.panelGroupsOf(collection).filter(include);
	return (
		<>
			{groups.map((group, index) =>
				group.fields.length === 0 ? null : (
					<PropertyGroup
						key={`${group.group ?? "group"}-${index}`}
						// A tab with one group needs no subheading.
						title={groups.length > 1 ? group.group : undefined}
					>
						{group.fields.map(renderField)}
					</PropertyGroup>
				),
			)}
		</>
	);
}
