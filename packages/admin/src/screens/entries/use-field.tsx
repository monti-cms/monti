"use client";

import type { SlugField, ValueField } from "@monti-cms/core/client";
import { roleValue, type SchemaCollection, schemaOf, storedField } from "@monti-cms/core/client";
import { createContext, type ReactNode, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import {
	assignStateSilently,
	createStateStore,
	notifyStateStore,
	type StateStore,
	useStoreSelector,
} from "../../hooks/store";
import type { SlotRequest } from "../../slots/registry";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import type { EntryData, EntryForm, EntryFormPatch, FormValue } from "./entry-form";

/**
 * One problem found in a field. `message` is the localized text to show as it is. Branch on `code`, never on the text.
 *
 * @experimental
 */
export interface FieldError {
	readonly code?: string;
	readonly message: string;
	/** The issue as the server reported it (`position` and the like). */
	readonly issue: CmsIssue;
}

/**
 * Everything a field UI needs, from {@link useField}. The component that holds it re-renders only when something of this field changes:
 * typing in another field does not touch it.
 *
 * @experimental
 */
export interface FieldState<V extends FormValue = FormValue> {
	/** The field name, as in the collection definition. A key that is not a schema field (a language tab key of a record) works too: `definition` is then undefined. */
	readonly name: string;
	/** The field in the collection definition. A conditional field's name gives its choice field. */
	readonly definition: ValueField | SlugField | undefined;
	readonly label: string;
	readonly description: string | undefined;
	readonly required: boolean;
	readonly hidden: boolean;

	readonly value: V;
	/** Changes this field only. Does nothing while `readOnly`. */
	setValue(next: V): void;

	/** Not editable now: the entry is disabled (trash, saving) or the field is shared on a translation. */
	readonly readOnly: boolean;
	/** `locked`: a field shared by the translation group, which shows the original's value. `disabled`: the whole form is disabled. */
	readonly readOnlyReason: "disabled" | "locked" | null;
	/** The note shown with a locked field (where the original is), if any. */
	readonly lockedNote: ReactNode;

	/** The first problem found in this field, if any. Never set on a locked field. */
	readonly error: FieldError | null;
	/** Every problem found in this field. */
	readonly errors: readonly FieldError[];
	readonly invalid: boolean;

	/** Ids for the label (`input`) and the error text (`error`), so the control and its messages are linked. */
	readonly ids: { readonly input: string; readonly error: string };
	/** Spread on the input. `aria-describedby` is set only while there is an error to describe. */
	readonly inputProps: {
		readonly id: string;
		readonly "aria-invalid"?: true;
		readonly "aria-describedby"?: string;
		readonly disabled?: true;
	};

	/**
	 * The request for the slot next to this field (AI and other actions). Pass it to `useSlotActions`. `null` on a locked field, where no
	 * action is placed. Its context and `apply` read the form when the action runs, not when it renders.
	 */
	readonly slotRequest: SlotRequest | null;
}

/**
 * What {@link EntryFormProvider} shares with the fields below it. The owner of the form state (the entry editor, a record panel)
 * passes its current values and the function that changes them.
 *
 * @experimental
 */
export interface EntryFormValue {
	readonly collection: SchemaCollection;
	readonly form: EntryForm;
	/** Applies a partial change: only the given keys change. Keys the form does not edit (values of removed fields) are left alone. */
	readonly setForm: (patch: EntryFormPatch) => void;
	/** Problems the server reported (publish failures). A field shows those whose `path` is its name. */
	readonly issues?: readonly CmsIssue[];
	/** The whole form is not editable now (trash, saving). */
	readonly disabled?: boolean;
	/** The id of the entry being edited. Absent on a new entry. */
	readonly entryId?: string;
	/** Language of the entry being edited. */
	readonly locale?: string;
	/** The saved entry. */
	readonly entry?: EntryData | null;
	/** Translation editing: fields shared by the translation group show `values` (the original's) read-only, with `note` beside them. */
	readonly locked?: { readonly values: EntryForm; readonly note: ReactNode };
}

/** What the fields read. A store, so a field subscribes to its own slice. */
interface EntryFormState {
	collection: SchemaCollection;
	form: EntryForm;
	setForm: (patch: EntryFormPatch) => void;
	issues: readonly CmsIssue[];
	disabled: boolean;
	entryId: string | undefined;
	locale: string | undefined;
	entry: EntryData | null;
	locked: { readonly values: EntryForm; readonly note: ReactNode } | undefined;
}

const EntryFormContext = createContext<StateStore<EntryFormState> | null>(null);

const NO_ISSUES: readonly CmsIssue[] = [];

/** Keeps the previous array when the new one holds the same issues, so a caller that builds `[]` on every render does not wake every field. */
function stableIssues(previous: readonly CmsIssue[], next: readonly CmsIssue[]): readonly CmsIssue[] {
	return previous.length === next.length && previous.every((issue, index) => issue === next[index]) ? previous : next;
}

/**
 * Shares one entry's form state with the fields below it. This is the lower layer: it needs no entry editor, so a panel that keeps its own
 * form state (a record panel) uses it as well. `useField` reads from it.
 *
 * The values are kept in a store: a field re-renders when its own value, error or read-only state changes, not when the form as a whole does.
 * Children that the parent keeps the same element for are therefore not re-rendered while another field is typed in.
 *
 * @experimental
 */
export function EntryFormProvider({ value, children }: { value: EntryFormValue; children: ReactNode }) {
	const [holder] = useState(() => {
		const setFormRef = { current: value.setForm };
		const store = createStateStore<EntryFormState>({
			collection: value.collection,
			form: value.form,
			// Stable for the life of the provider, so a field's `setValue` keeps its identity.
			setForm: (patch) => setFormRef.current(patch),
			issues: value.issues ?? NO_ISSUES,
			disabled: Boolean(value.disabled),
			entryId: value.entryId,
			locale: value.locale,
			entry: value.entry ?? null,
			locked: value.locked,
		});
		return { store, setFormRef, version: 0, notified: 0 };
	});
	const { store } = holder;

	const state = store.getState();
	const changed = assignStateSilently(store, {
		collection: value.collection,
		form: value.form,
		setForm: state.setForm,
		issues: stableIssues(state.issues, value.issues ?? NO_ISSUES),
		disabled: Boolean(value.disabled),
		entryId: value.entryId,
		locale: value.locale,
		entry: value.entry ?? null,
		locked: value.locked,
	});
	if (changed) holder.version += 1;

	useLayoutEffect(() => {
		holder.setFormRef.current = value.setForm;
		if (holder.notified === holder.version) return;
		holder.notified = holder.version;
		notifyStateStore(store);
	});

	return <EntryFormContext.Provider value={store}>{children}</EntryFormContext.Provider>;
}

/** The store of the nearest {@link EntryFormProvider}. Internal: the default field UI uses it for what `useField` does not cover. */
export function useEntryFormStore(): StateStore<EntryFormState> {
	const store = useContext(EntryFormContext);
	if (!store) throw new Error("useField needs an EntryFormProvider above it.");
	return store;
}

/** Subscribes to one slice of the form state. The selector must return a stable value. */
export function useEntryFormSelector<T>(selector: (state: EntryFormState) => T): T {
	return useStoreSelector(useEntryFormStore(), selector);
}

const fieldId = (name: string) => `cms-${name}`;

interface ResolvedField {
	definition: ValueField | SlugField | undefined;
	/** Whether a translation shows the original's value for it (a field the translation group shares). */
	lockable: boolean;
}

/** The definition of a field by name (nested fields of a conditional field included) and whether a translation shares it. */
function resolveField(collection: SchemaCollection, name: string): ResolvedField {
	const fields = schemaOf(collection).fields;
	const own = fields[name];
	if (own?.kind === "slug") return { definition: own, lockable: false };
	const stored = storedField(collection, name);
	if (!stored) return { definition: undefined, lockable: false };
	// A field that depends on a conditional field follows that field's `localized`.
	const owner = stored.when ? fields[stored.when.field] : own;
	return { definition: stored.field, lockable: !owner?.localized };
}

/**
 * The value, change, error, read-only state, ids and slot request of one form field, for a field UI of your own. The component re-renders only
 * when this field changes.
 *
 * Must be used below an `EntryFormProvider` (the entry editor and the record panel provide one). The label row, the layout and the slot button
 * are yours to draw: pass `slotRequest` to `useSlotActions` for the actions attached to the field.
 *
 * @experimental
 */
export function useField<V extends FormValue = FormValue>(name: string): FieldState<V> {
	const store = useEntryFormStore();
	const collection = useStoreSelector(store, (state) => state.collection);
	const { definition, lockable } = useMemo(() => resolveField(collection, name), [collection, name]);

	const locked = useStoreSelector(store, (state) => lockable && Boolean(state.locked));
	const lockedNote = useStoreSelector(store, (state) => (lockable ? state.locked?.note : undefined));
	const disabled = useStoreSelector(store, (state) => state.disabled);
	const stored = useStoreSelector(
		store,
		(state) => (lockable && state.locked ? state.locked.values : state.form)[name],
	);
	const issues = useStoreSelector(store, (state) => state.issues);
	const entryId = useStoreSelector(store, (state) => state.entryId);
	const locale = useStoreSelector(store, (state) => state.locale);

	const readOnly = disabled || locked;
	const value = (stored ?? null) as V;

	const setValue = useCallback(
		(next: V) => {
			if (readOnly) return;
			store.getState().setForm({ [name]: next });
		},
		[store, name, readOnly],
	);

	const errors = useMemo(
		(): FieldError[] =>
			locked
				? []
				: issues
						.filter((issue) => issue.path === name)
						.map((issue) => ({ code: issue.code, message: cmsIssueMessage(issue), issue })),
		[issues, name, locked],
	);

	const slotRequest = useMemo((): SlotRequest | null => {
		if (locked) return null;
		return {
			slot: "field",
			target: name,
			collection,
			scope: entryId ?? "new",
			disabled,
			getContext: () => {
				const { form } = store.getState();
				const current = form[name];
				return {
					collection,
					locale,
					entryId,
					title: form.title,
					summary: summaryOf(collection, form),
					body: form.mdx,
					current: Array.isArray(current) ? current : typeof current === "string" ? current : undefined,
				};
			},
			apply: (next, mode) => {
				const { form, setForm } = store.getState();
				if (mode === "append") {
					const current = form[name];
					const list = Array.isArray(current) ? current : [];
					if (!list.includes(next)) setForm({ [name]: [...list, next] });
				} else setForm({ [name]: next });
			},
		};
	}, [store, locked, name, collection, entryId, locale, disabled]);

	const error = errors[0] ?? null;
	const ids = useMemo(() => ({ input: fieldId(name), error: `${fieldId(name)}-error` }), [name]);
	const inputProps = useMemo(
		() => ({
			id: ids.input,
			...(error ? { "aria-invalid": true as const, "aria-describedby": ids.error } : {}),
			...(readOnly ? { disabled: true as const } : {}),
		}),
		[ids, error, readOnly],
	);

	return useMemo(
		(): FieldState<V> => ({
			name,
			definition,
			label: definition?.label ?? name,
			description: definition?.description,
			required: Boolean(definition && "required" in definition && definition.required) && !locked,
			hidden: Boolean(definition && "hidden" in definition && definition.hidden),
			value,
			setValue,
			readOnly,
			readOnlyReason: locked ? "locked" : disabled ? "disabled" : null,
			lockedNote,
			error,
			errors,
			invalid: error !== null,
			ids,
			inputProps,
			slotRequest,
		}),
		[
			name,
			definition,
			value,
			setValue,
			readOnly,
			locked,
			disabled,
			lockedNote,
			error,
			errors,
			ids,
			inputProps,
			slotRequest,
		],
	);
}

function summaryOf(collection: SchemaCollection, form: EntryForm): string | undefined {
	return roleValue(collection, "summary", form) || undefined;
}
