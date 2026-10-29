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
import { Affix, IconButton, Inline, PropertyGroup, PropertyRow, Text, TextButton } from "@monti-cms/ui";
import {
	type FocusEvent,
	memo,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { type FieldInputEntry, isFieldInputParts } from "../../admin-components";
import { fieldIssueLine } from "../../api/error-message";
import { commonMessages } from "../../lib/common.messages";
import { isComposingKey } from "../../lib/keyboard";
import { type SlotRequest, SlotScope } from "../../slots/slots";
import {
	BacklinkInput,
	backlinkMembers,
	changeBacklinkRecord,
	type FieldInputProps,
	type IncomingReference,
} from "./field-inputs";
import { FieldView } from "./field-views";
import { MediaValue } from "./media-image-input";
import { entriesMessages } from "./messages";
import { PropertyEditContext, usePropertyEdit } from "./property-edit";
import { DefaultInput, useRegisteredInput } from "./schema-fields";
import { type FieldState, useEntryFormSelector, useEntryFormStore, useField } from "./use-field";
import { useRelationSearch } from "./use-relation-search";

/**
 * Opening a property in place. Pressing the value opens its field and puts the caret in it; the field closes when it says it is done (Enter, Escape,
 * a closed list) or when focus leaves the row. Focus that moved into a window or a list opened from the field (picking a file, adding a name) does not
 * end it: the field is still in use, and closing it would take that window with it.
 */
function useEditInPlace(controlId: string): {
	editing: boolean;
	open: () => void;
	done: () => void;
	rowRef: RefObject<HTMLDivElement | null>;
	onBlur: (event: FocusEvent<HTMLElement>) => void;
} {
	const [editing, setEditing] = useState(false);
	const rowRef = useRef<HTMLDivElement>(null);
	const open = useCallback(() => setEditing(true), []);
	const done = useCallback(() => setEditing(false), []);
	// The caret goes into the field as soon as it can take it (a list that is still loading keeps its input disabled for a moment).
	useEffect(() => {
		if (!editing) return;
		let tries = 0;
		let timer: number | undefined;
		const attempt = () => {
			const control = document.getElementById(controlId) as HTMLInputElement | null;
			if (control && !control.disabled) control.focus();
			else if (++tries < 20) timer = window.setTimeout(attempt, 50);
		};
		attempt();
		return () => window.clearTimeout(timer);
	}, [editing, controlId]);
	const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
		if (rowRef.current?.contains(event.relatedTarget as Node | null)) return;
		window.setTimeout(() => {
			const row = rowRef.current;
			if (!row || row.contains(document.activeElement)) return;
			if (document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')) return;
			setEditing(false);
		}, 0);
	}, []);
	return { editing, open, done, rowRef, onBlur };
}

interface FocusRequest {
	/** The field the page asked to bring up (a publish problem). */
	path: string | null;
	onFocused: () => void;
}

/** Usages of the entry the caller already loaded. A backlink row reads its members from them without fetching again. */
export interface SchemaFieldsReferences {
	items: readonly IncomingReference[];
	loading: boolean;
	refresh: () => void;
}

interface ShellProps {
	/** The field name, as the page names it for a jump to a publish problem. */
	name: string;
	controlId: string;
	label: string;
	/** Draws the value at rest. */
	display: ReactNode;
	isEmpty: boolean;
	/** The input, opened in place. */
	editor: ReactNode;
	/** The input is always there (an input a site registered draws its own value). */
	alwaysOpen?: boolean;
	/** The assistant wrote the value and nobody has edited it. */
	assisted: boolean;
	readOnly: boolean;
	note?: ReactNode;
	issue?: Parameters<typeof fieldIssueLine>[0];
	errorId?: string;
	/** On the label row while the input is open: a count, a piece an extension added. */
	extras?: ReactNode;
	slot?: SlotRequest | null;
	focus: FocusRequest;
}

/** One property row: the label with its actions, the value at rest, the input in place. */
function PropertyShell({
	name,
	controlId,
	label,
	display,
	isEmpty,
	editor,
	alwaysOpen = false,
	assisted,
	readOnly,
	note,
	issue,
	errorId,
	extras,
	slot,
	focus,
}: ShellProps) {
	const { editing, open, done, rowRef, onBlur } = useEditInPlace(controlId);
	const jump = focus.path === name;
	useEffect(() => {
		if (!jump) return;
		open();
		focus.onFocused();
	}, [jump, open, focus.onFocused]);
	const edit = useMemo(() => ({ proposal: assisted, done }), [assisted, done]);
	const isOpen = alwaysOpen || editing;
	const row = (trigger: ReactNode, failure: ReactNode) => (
		<PropertyRow
			ref={rowRef}
			onBlur={onBlur}
			label={label}
			controlId={controlId}
			action={
				(isOpen && extras) || trigger ? (
					<Inline gap={8}>
						{isOpen && extras}
						{trigger}
					</Inline>
				) : undefined
			}
			value={display}
			empty={isEmpty}
			proposal={assisted}
			onEdit={readOnly ? undefined : open}
			editing={isOpen}
			note={note}
			error={issue ? fieldIssueLine(issue) : failure}
			errorId={issue ? errorId : undefined}
		>
			<PropertyEditContext.Provider value={edit}>{editor}</PropertyEditContext.Provider>
		</PropertyRow>
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
	const props: FieldInputProps = {
		collection,
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
	const parts = registered && isFieldInputParts(registered) ? registered : undefined;
	// A component a site registered draws its own value, so it stays open. Parts keep the default value and input.
	const custom = registered && !parts ? true : parts?.Input !== undefined;
	const Aside = parts?.Aside;
	const Empty = parts?.Empty;
	const Input = parts?.Input;
	const empty = isBlank(field.value) && !alwaysHasValue(definition);
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
			editor={Input === null ? null : Input ? <Input {...props} /> : <DefaultInput {...props} parts={parts} />}
			alwaysOpen={custom}
			assisted={field.assisted}
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
			display={slug ? `/${slug}` : definition.from ? t("property.slugFromTitle") : t("property.empty")}
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
			onKeyDown={(event) => {
				if ((event.key === "Enter" && !isComposingKey(event)) || event.key === "Escape") edit?.done();
			}}
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
	return field.label ? (
		<PropertyRow label={field.label} editing>
			{view}
		</PropertyRow>
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
	const field = site.schemaOf(collection).fields[name] as BacklinkField;
	const marked = useField(name);
	// On a translation, the original's value is only shown (relations point to the original).
	const targetId = groupId ?? entryId;
	const shared = targetId === entryId && references ? references : undefined;
	const names = shared ? backlinkMembers(shared.items, field, tc("untitled")).map((member) => member.title) : [];
	const refresh = shared?.refresh;
	// The assistant picks a series: the post goes into it at once (saved apart from the draft), and the row reads it in the assistant's blue until it is changed.
	const request = marked.slotRequest;
	const slot = useMemo(
		() =>
			request && targetId
				? {
						...request,
						filled: names.length > 0,
						apply: async (id: string) => {
							await changeBacklinkRecord(
								site,
								field,
								id,
								(ids) => (ids.includes(targetId) ? ids : [...ids, targetId]),
								tc("saveFailed"),
							);
							store.getState().setAssisted(name, true);
							refresh?.();
						},
					}
				: null,
		[request, targetId, names.length, site, field, tc, store, name, refresh],
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
 * The properties of the entry as a read list, in the order of the collection's layout: a group with a name gets its quiet subheading, and every field is a
 * row whose value opens for editing in place. The values, issues and read-only state come from the nearest `EntryFormProvider`.
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
