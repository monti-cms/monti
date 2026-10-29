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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorText, isConflict } from "../../api/client";
import { entriesKeys, getEntry, getEntryRelations, updateEntry } from "../../api/entries";
import { commonMessages } from "../../lib/common.messages";
import { moveWithin } from "../../lib/utils/move-within";
import type { TranslatorFor } from "../../translator";
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
 * Changes the other record's relation list (`field.via`) and saves it at once, apart from the draft and publish state of the post. For a record collection, saving is
 * publishing. If the versions diverge (changed elsewhere first), it re-reads the latest value and tries once more.
 */
export async function changeBacklinkRecord(
	site: Site,
	field: BacklinkField,
	recordId: string,
	change: (ids: string[]) => string[],
	failed: string,
): Promise<void> {
	for (let attempt = 0; attempt < 2; attempt++) {
		const record = await getEntry<RecordEntry>(site, recordId);
		const current = record.working.metadata[field.via];
		const ids = Array.isArray(current) ? current.filter((id): id is string => typeof id === "string") : [];
		try {
			await updateEntry(
				site,
				recordId,
				{
					expectedVersion: record.version,
					slug: record.workingSlug,
					metadata: { ...record.working.metadata, [field.via]: change(ids) },
				},
				failed,
			);
			return;
		} catch (saveError) {
			if (!isConflict(saveError) || attempt === 1) throw saveError;
		}
	}
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
 * Inverse relation input. E.g. a post's `collection`. Saves the other record's (collection's) multi relation field (`itemIds`)
 * immediately on click, independent of this post's draft and publish. Adding appends to the end; removing removes every slot holding this post.
 * If versions diverge (changed elsewhere first), it re-reads the latest value and tries once more.
 */
export function BacklinkInput({
	id,
	field,
	targetId,
	disabled,
	shared,
	onChange,
}: {
	/** The id of the input, so a label (or the properties list) can point to it. */
	id?: string;
	field: BacklinkField;
	/** ID of this post. For a translation, the original's ID (relations point to the original). Absent for a new post. */
	targetId: string | undefined;
	disabled: boolean;
	/** Usages of the same post loaded by the properties panel. If present, use them; after saving, reload with `refresh`. */
	shared?: { references: readonly IncomingReference[]; loading: boolean; refresh: () => void };
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
	/** Load/save failure. Shown right below the input like other relation inputs. */
	const [error, setError] = useState<string | null>(null);

	const membersOf = useCallback(
		(references: readonly IncomingReference[]) => backlinkMembers(references, field, tc("untitled")),
		[field, tc],
	);

	const refreshShared = shared?.refresh;
	// If the properties panel already loaded this post's usages, do not fetch separately.
	const usesShared = Boolean(shared);
	const relationsQuery = useQuery({
		queryKey: entriesKeys.relations(targetId ?? ""),
		queryFn: ({ signal }) =>
			getEntryRelations<{ incomingReferences: IncomingReference[] }>(site, targetId as string, signal),
		enabled: Boolean(targetId) && !usesShared,
		retry: false,
	});
	const load = useCallback(async () => {
		if (!targetId) return;
		if (refreshShared) {
			refreshShared();
			return;
		}
		await relationsQuery.refetch();
	}, [targetId, refreshShared, relationsQuery.refetch]);
	const fetched = relationsQuery.data ? membersOf(relationsQuery.data.incomingReferences) : null;
	const loadError = relationsQuery.error ? errorText(site, relationsQuery.error, t("entry.loadFailed")) : null;

	const members = shared
		? shared.loading && shared.references.length === 0
			? null
			: membersOf(shared.references)
		: fetched;

	const update = (recordId: string, change: (ids: string[]) => string[]) =>
		changeBacklinkRecord(site, field, recordId, change, tc("saveFailed"));

	// On pick or remove, reflect on screen first (optimistic) and save in turn in the background. On failure, notify and revert only that change.
	const [optimistic, setOptimistic] = useState<string[] | null>(null);
	const pendingRef = useRef(0);
	const queueRef = useRef<Promise<void>>(Promise.resolve());
	const awaitingServerRef = useRef(false);
	/** Collection just created with this post in it. Not saved again. */
	const createdRef = useRef(new Set<string>());
	const serverIds = useMemo(() => members?.map((member) => member.id) ?? [], [members]);
	const serverKey = serverIds.join(",");
	const serverIdsRef = useRef(serverIds);
	serverIdsRef.current = serverIds;

	// When saved server values arrive after all saves finish, drop the optimistic value.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the server ids
	useEffect(() => {
		if (awaitingServerRef.current && pendingRef.current === 0) {
			awaitingServerRef.current = false;
			setOptimistic(null);
		}
	}, [serverKey]);

	const enqueue = (task: () => Promise<void>, failure: string, revert: (ids: string[]) => string[]) => {
		pendingRef.current += 1;
		queueRef.current = queueRef.current.then(async () => {
			try {
				await task();
			} catch (taskError) {
				setError(errorText(site, taskError, failure));
				setOptimistic((current) => revert(current ?? serverIdsRef.current));
			} finally {
				pendingRef.current -= 1;
				if (pendingRef.current === 0) {
					awaitingServerRef.current = true;
					await load();
				}
			}
		});
	};

	if (!targetId) {
		return (
			<Text as="p" variant="caption" tone="muted">
				{t("backlink.saveDraft", { label: field.label })}
			</Text>
		);
	}

	const shown = optimistic ?? serverIds;
	const options = (records.options ?? [])
		.filter((option) => kind.accepts(option.id))
		.map((option) => ({ value: option.id, label: option.title }));
	// Names of the picked values, which a search may not return (a collection just created is not in the public list yet).
	const known = [
		...records.known.map((entry) => ({ value: entry.id, label: entry.title })),
		...(members ?? []).map((member) => ({ value: member.id, label: member.title })),
	];

	const change = (next: string[]) => {
		setError(null);
		onChange?.();
		const added = next.filter((id) => !shown.includes(id) && !createdRef.current.delete(id));
		const removed = shown.filter((id) => !next.includes(id));
		setOptimistic(next);
		for (const recordId of added) {
			enqueue(
				() => update(recordId, (ids) => (ids.includes(targetId) ? ids : [...ids, targetId])),
				t("backlink.addFailed", { label: field.label }),
				(ids) => ids.filter((id) => id !== recordId),
			);
		}
		for (const recordId of removed) {
			enqueue(
				() => update(recordId, (ids) => ids.filter((id) => id !== targetId)),
				t("backlink.removeFailed", { label: field.label }),
				(ids) => (ids.includes(recordId) ? ids : [...ids, recordId]),
			);
		}
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
				value={shown}
				disabled={disabled || members === null || (records.options === null && !records.error)}
				onValueChange={change}
				onCreate={
					field.createInline
						? async (title) => {
								// Open with this post already in the add field. After saving, reload the options so it shows up in the list right away.
								const saved = await creator.create(field.from as Collection, title, {
									...kind.createMetadata,
									[field.via]: [targetId],
								});
								if (!saved) return null;
								createdRef.current.add(saved.id);
								records.remember({ ...optionOf(site, tc("untitled"), field.from, saved), status: saved.status });
								awaitingServerRef.current = true;
								void load();
								return saved.id;
							}
						: undefined
				}
			/>
			{(error ?? loadError) && <FormFieldError>{error ?? loadError}</FormFieldError>}
			<SearchError failed={records.error} />
			{creator.sheet}
		</>
	);
}
