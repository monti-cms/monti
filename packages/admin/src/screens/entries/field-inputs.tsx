"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { BacklinkField, RelationField, ValueField } from "@monti-cms/core";
import type { Collection } from "@monti-cms/core/site";
import { type SchemaCollectionName, type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { FormFieldError, Stack, Text } from "@monti-cms/ui";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "../../api/client";
import { entriesKeys, getEntry, getEntryRelations } from "../../api/entries";
import { commonMessages } from "../../lib/common.messages";
import { moveWithin } from "../../lib/utils/move-within";
import type { TranslatorFor } from "../../translator";
import { type BacklinkChange, backlinkChangeTo, backlinkShown } from "./backlink-changes";
import type { EntryForm, FormValue } from "./entry-form";
import { entriesMessages } from "./messages";
import { optionOf, useRecordCreator } from "./record-create-sheet";
import { RelationCombobox } from "./relation-combobox";
import { SortableEntryRow } from "./sortable-entry-row";
import { type RelationEntry, useRelationSearch } from "./use-relation-search";

/** Values an input needs from outside the field. The edit screen fills them. */
export interface FieldContext {
	/** ID of the content being edited. Keeps it from picking itself as a relation target. */
	entryId?: string;
	disabled: boolean;
	/** Language of the content being edited. The AI action next to a field checks slug conflicts in this language. */
	locale?: string;
	/** Translation group ID (original ID). An inverse relation points to the original. */
	groupId?: string;
	/** Usages of this post already loaded by the properties panel. An inverse relation for the same post does not fetch again. */
	incomingReferences?: readonly IncomingReference[];
	incomingReferencesLoading?: boolean;
	refreshIncomingReferences?: () => void;
	/** The saved post (view fields read the original value and language). */
	entry?: import("./entry-form").EntryData | null;
}

export interface FieldInputProps {
	/** Collection of the content being edited. */
	collection: string;
	name: string;
	field: ValueField;
	id: string;
	value: FormValue;
	invalid: boolean;
	describedBy?: string;
	context: FieldContext;
	/** All values currently being entered (when other fields such as title or summary are used in hint text). Shared fields of a translation hold the original's values. */
	form: EntryForm;
	onChange: (value: FormValue) => void;
}

/** Row count of a multi-line text input (`rows`, 2 if absent). */
export function multilineProps(field: { readonly rows?: number }): { rows: number } {
	const rows = field.rows !== undefined && field.rows >= 1 ? Math.floor(field.rows) : 2;
	return { rows };
}

type EntryOption = RelationEntry;

/** Label of the relation target collection (e.g. `Posts`). Used in input hint text. */
const targetLabel = (site: Site, relation: RelationField) =>
	site.isCollection(relation.to) ? site.schemaOf(relation.to).label : relation.to;

/** Posts that are not published get a marker after the name, because they are missing from the public list of collections and replacement posts. */
const entryLabel = (t: TranslatorFor<typeof entriesMessages>, option: EntryOption) =>
	option.status === "published" ? option.title : `${option.title}${t("entry.unpublished")}`;

/** The picker's options and the names of its picked values, from a server search (`useRelationSearch`). Leaves out the entry being edited. */
function relationOptions(
	t: TranslatorFor<typeof entriesMessages>,
	search: ReturnType<typeof useRelationSearch>,
	selfId: string | undefined,
) {
	const option = (entry: EntryOption) => ({ value: entry.id, label: entryLabel(t, entry) });
	return {
		options: (search.options ?? []).filter((entry) => entry.id !== selfId).map(option),
		known: search.known.map(option),
	};
}

/** The failure of a search, under the input like the other relation inputs. */
function SearchError({ failed }: { failed: boolean }) {
	const t = useTranslator(entriesMessages);
	return failed ? <FormFieldError>{t("entry.loadFailed")}</FormFieldError> : null;
}

/** Single relation. Typing searches the target entries on the server (best title matches first); pressing shows the first ones. */
export function EntryPicker({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	const relation = field as RelationField;
	const selected = typeof value === "string" && value ? [value] : [];
	const search = useRelationSearch({ collection: relation.to, publishedOnly: relation.publishedOnly, selected });
	const waiting = search.options === null && !search.error;
	return (
		<>
			<RelationCombobox
				id={id}
				aria-label={field.label}
				placeholder={
					waiting ? tc("loading") : (relation.placeholder ?? t("entry.choose", { target: targetLabel(site, relation) }))
				}
				invalid={invalid}
				describedBy={describedBy}
				disabled={context.disabled || waiting}
				multiple={false}
				{...relationOptions(t, search, context.entryId)}
				onSearch={search.search}
				loading={search.loading}
				value={selected}
				onValueChange={(next) => onChange(next[0] ?? null)}
			/>
			<SearchError failed={search.error} />
		</>
	);
}

/**
 * Ordered multi relation (post targets). Used by collection items.
 * Check posts in the `Add/remove posts` list above to add or remove them (added ones go to the end), and drag in the list below to reorder.
 */
export function OrderedEntryList({ field, id, value, context, onChange }: FieldInputProps) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	const relation = field as RelationField;
	const ids = Array.isArray(value) ? value : [];
	const search = useRelationSearch({ collection: relation.to, publishedOnly: relation.publishedOnly, selected: ids });
	const waiting = search.options === null && !search.error;
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	// The same post can be added twice (legacy data), so the index is also used as the drag ID.
	const sortableIds = ids.map((itemId, index) => `${index}:${itemId}`);

	const move = (index: number, direction: -1 | 1) => {
		const target = index + direction;
		if (target < 0 || target >= ids.length) return;
		onChange(moveWithin(ids, index, target));
	};
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		onChange(moveWithin(ids, sortableIds.indexOf(String(active.id)), sortableIds.indexOf(String(over.id))));
	};
	/** Selection returned by the checklist. Remaining posts keep the current order and new posts are appended. */
	const applySelection = (selected: string[]) => {
		const chosen = new Set(selected);
		const kept = ids.filter((itemId) => chosen.has(itemId));
		onChange([...kept, ...selected.filter((itemId) => !ids.includes(itemId))]);
	};
	const target = targetLabel(site, relation);
	/** The row of a post that was looked up and is not there (deleted, trashed). Before the lookup answers, the row says it is loading. */
	const rowOf = (itemId: string): EntryOption | undefined =>
		search.entryOf(itemId) ??
		(search.isMissing(itemId)
			? { id: itemId, title: t("entry.missing", { target }), slug: null, status: "missing" }
			: undefined);

	return (
		<Stack gap={8}>
			<RelationCombobox
				id={id}
				aria-label={t("entry.editList", { target })}
				placeholder={waiting ? tc("loading") : (relation.placeholder ?? t("entry.editList", { target }))}
				disabled={context.disabled || waiting}
				multiple
				showChips={false}
				{...relationOptions(t, search, context.entryId)}
				onSearch={search.search}
				loading={search.loading}
				value={ids}
				onValueChange={applySelection}
			/>
			<SearchError failed={search.error} />
			{ids.length === 0 ? (
				<Text as="p" variant="caption" tone="muted">
					{t("entry.empty", { target })}
				</Text>
			) : (
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
					<SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
						<Stack as="ol" gap={4} aria-label={t("entry.listAria", { target })}>
							{ids.map((itemId, index) => (
								<SortableEntryRow
									key={sortableIds[index]}
									sortableId={sortableIds[index] as string}
									index={index}
									count={ids.length}
									option={rowOf(itemId)}
									disabled={context.disabled}
									onMove={(direction) => move(index, direction)}
									onRemove={() => onChange(ids.filter((_, i) => i !== index))}
								/>
							))}
						</Stack>
					</SortableContext>
				</DndContext>
			)}
		</Stack>
	);
}

type RecordEntry = {
	id: string;
	version: number;
	workingSlug: string | null;
	working: { metadata: Record<string, unknown> };
};
export type IncomingReference = {
	state: "working" | "published";
	sourceId: string;
	sourceCollection: string;
	sourceTitle: string | null;
	occurrences: readonly { type: string; path?: string }[];
};

/** The records an inverse relation holds now, from the usages of this post: the ones whose working copy lists it in the `via` field. */
export function backlinkMembers(
	references: readonly IncomingReference[],
	field: BacklinkField,
	untitled: string,
): { id: string; title: string }[] {
	const found = new Map<string, string>();
	for (const reference of references) {
		const viaField = reference.occurrences.some((occurrence) => occurrence.path === field.via);
		if (reference.state === "working" && reference.sourceCollection === field.from && viaField) {
			found.set(reference.sourceId, reference.sourceTitle || untitled);
		}
	}
	return [...found].map(([id, title]) => ({ id, title }));
}

/**
 * If an inverse relation is a conditional list on the other record (a field that exists only for one value of a select field),
 * only records matching that condition can be picked. The currently chosen kind is read per record to filter.
 * Relations without a condition are not filtered.
 */
function useRecordKind(field: BacklinkField, options: readonly { id: string }[]) {
	const site = useSite();
	const requirement = site.storedField(field.from as SchemaCollectionName, field.via)?.when;
	const discriminant = requirement
		? site.storedField(field.from as SchemaCollectionName, requirement.field)?.field
		: undefined;
	const defaultValue = discriminant?.kind === "select" ? discriminant.defaultValue : undefined;
	// Each record's kind is read once (a record that cannot be read counts as the default kind).
	const records = useQueries({
		queries: options.map((option) => ({
			queryKey: entriesKeys.detail(option.id),
			queryFn: ({ signal }: { signal: AbortSignal }) => getEntry<RecordEntry>(site, option.id, signal),
			enabled: Boolean(requirement),
			retry: false,
		})),
	});
	const kinds = new Map<string, string>();
	options.forEach((option, index) => {
		const record = records[index];
		if (!record || !(record.data || record.isError)) return;
		const value = requirement ? record.data?.working.metadata[requirement.field] : undefined;
		kinds.set(option.id, record.data ? (typeof value === "string" ? value : (defaultValue ?? "")) : "");
	});

	return {
		ready: !requirement || options.every((option) => kinds.has(option.id)),
		accepts: (id: string) => !requirement || kinds.get(id) === requirement.value,
		/** Sets the kind so a newly created record accepts this relation. Not written separately for the default kind. */
		createMetadata: requirement && requirement.value !== defaultValue ? { [requirement.field]: requirement.value } : {},
	};
}

/**
 * The picks a backlink field shows. Once the save wrote them, the editor drops them, and `refresh` reads the server's records again: until that
 * read is back the written picks stay on screen, so the field does not show the old records in between. A pick the save could not write (the
 * field has a reason) is not kept. Without `refresh` nothing is read again (the caller reads them).
 */
export function useWrittenPick(
	pick: { change: BacklinkChange | undefined; error: string | undefined } | undefined,
	refresh: (() => unknown) | undefined,
): BacklinkChange | undefined {
	const change = pick?.change;
	const error = pick?.error;
	const [written, setWritten] = useState<BacklinkChange>();
	const last = useRef<BacklinkChange>(undefined);
	const mounted = useRef(true);
	useEffect(
		() => () => {
			mounted.current = false;
		},
		[],
	);
	useEffect(() => {
		if (change) {
			last.current = change;
			return;
		}
		const done = last.current;
		last.current = undefined;
		if (!done || !refresh) return;
		if (!error) setWritten(done);
		void Promise.resolve(refresh()).finally(() => {
			if (mounted.current) setWritten(undefined);
		});
	}, [change, error, refresh]);
	return change ?? written;
}

/**
 * Inverse relation input. E.g. a post's `collection`. A pick is an unsaved change of the post like any other field: `pick` keeps it, and the post's save
 * writes it to the other record's multi relation field (`itemIds`). Adding appends to the end; removing removes every slot holding this post. Without
 * `pick` (a form with no entry save behind it) the input only shows the records.
 */
export function BacklinkInput({
	id,
	field,
	targetId,
	disabled,
	shared,
	pick,
	onChange,
}: {
	/** The id of the input, so a label (or the properties list) can point to it. */
	id?: string;
	field: BacklinkField;
	/** ID of this post. For a translation, the original's ID (relations point to the original). Absent for a new post. */
	targetId: string | undefined;
	disabled: boolean;
	/** Usages of the same post loaded by the properties panel. If present, use them; after saving, reload with `refresh`. */
	shared?: { references: readonly IncomingReference[]; loading: boolean; refresh: () => Promise<void> | void };
	/** The unsaved picks of this field, why the last save could not write them, and the call that changes them. */
	pick?: {
		change: BacklinkChange | undefined;
		error: string | undefined;
		set: (change: BacklinkChange | null) => void;
	};
	/** The person picked or removed a record. */
	onChange?: () => void;
}) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	// The records come from a server search (published ones, like the old list). A conditional list keeps only the records of one kind, which is
	// known per record, so it asks for more hits to leave enough after that filter.
	const conditional = Boolean(site.storedField(field.from as SchemaCollectionName, field.via)?.when);
	const records = useRelationSearch({
		collection: field.from,
		publishedOnly: true,
		limit: conditional ? 50 : undefined,
		enabled: Boolean(targetId),
	});
	const creator = useRecordCreator();
	const kind = useRecordKind(field, records.options ?? []);
	/** Records created here: their names, before a search lists them. */
	const createdRef = useRef(new Map<string, string>());

	const membersOf = useCallback(
		(references: readonly IncomingReference[]) => backlinkMembers(references, field, tc("untitled")),
		[field, tc],
	);

	// If the properties panel already loaded this post's usages, do not fetch separately.
	const usesShared = Boolean(shared);
	const relationsQuery = useQuery({
		queryKey: entriesKeys.relations(targetId ?? ""),
		queryFn: ({ signal }) =>
			getEntryRelations<{ incomingReferences: IncomingReference[] }>(site, targetId as string, signal),
		enabled: Boolean(targetId) && !usesShared,
		retry: false,
	});
	const refetch = relationsQuery.refetch;
	const fetched = relationsQuery.data ? membersOf(relationsQuery.data.incomingReferences) : null;
	const loadError = relationsQuery.error ? errorText(site, relationsQuery.error, t("entry.loadFailed")) : null;

	const members = shared
		? shared.loading && shared.references.length === 0
			? null
			: membersOf(shared.references)
		: fetched;

	// Without usages from the properties panel the input reads them itself, so it reads them again once the save wrote its picks.
	const change = useWrittenPick(pick, shared ? undefined : refetch);
	if (!targetId) {
		return (
			<Text as="p" variant="caption" tone="muted">
				{t("backlink.saveDraft", { label: field.label })}
			</Text>
		);
	}

	const shown = backlinkShown(members ?? [], change);
	const options = (records.options ?? [])
		.filter((option) => kind.accepts(option.id))
		.map((option) => ({ value: option.id, label: option.title }));
	// Names of the picked values, which a search may not return (a collection just created is not in the public list yet).
	const known = [
		...records.known.map((entry) => ({ value: entry.id, label: entry.title })),
		...shown.map((member) => ({ value: member.id, label: member.title })),
	];
	const titleOf = (recordId: string) =>
		createdRef.current.get(recordId) ??
		[...options, ...known].find((option) => option.value === recordId)?.label ??
		tc("untitled");

	const set = pick?.set;
	const onValueChange = (next: string[]) => {
		if (!set) return;
		onChange?.();
		set(backlinkChangeTo(members ?? [], next, titleOf));
	};

	return (
		<>
			<RelationCombobox
				id={id}
				multiple
				aria-label={field.label}
				placeholder={members === null || records.options === null ? tc("loading") : t("relation.searchOrAdd")}
				options={options}
				known={known}
				onSearch={records.search}
				loading={records.loading || !kind.ready}
				value={shown.map((member) => member.id)}
				disabled={!set || disabled || members === null || (records.options === null && !records.error)}
				onValueChange={onValueChange}
				onCreate={
					field.createInline && set
						? async (title) => {
								// The new record is made now, empty; putting this post in it is a pick like any other, written by the post's save.
								const saved = await creator.create(field.from as Collection, title, kind.createMetadata);
								if (!saved) return null;
								const option = optionOf(site, tc("untitled"), field.from, saved);
								createdRef.current.set(saved.id, option.title);
								records.remember({ ...option, status: saved.status });
								return saved.id;
							}
						: undefined
				}
			/>
			{(pick?.error ?? loadError) && <FormFieldError>{pick?.error ?? loadError}</FormFieldError>}
			<SearchError failed={records.error} />
			{creator.sheet}
		</>
	);
}
