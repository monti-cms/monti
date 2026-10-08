"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { IconButton } from "../../ui/icon-button.js";
import { CmsApiError, cmsFetch, errorText } from "../admin-api.js";
import { entriesMessages } from "./messages.js";
import { optionOf, useRecordCreator } from "./record-create-sheet.js";
import { RelationCombobox } from "./relation-combobox.js";
import { useRelationSearch } from "./use-relation-search.js";
export const inputClass = "h-8 text-xs md:text-xs";
/** Row count of a multi-line text input (`rows`, 2 if absent) and the minimum height that shows that many rows (text lines + vertical padding). */
export function multilineProps(field) {
    const rows = field.rows !== undefined && field.rows >= 1 ? Math.floor(field.rows) : 2;
    return { rows, style: { minHeight: `${rows + 1}rem` } };
}
/** Label of the relation target collection (e.g. `Posts`). Used in input hint text. */
const targetLabel = (site, relation) => site.isCollection(relation.to) ? site.schemaOf(relation.to).label : relation.to;
/** Posts that are not published get a marker after the name, because they are missing from the public list of collections and replacement posts. */
const entryLabel = (t, option) => option.status === "published" ? option.title : `${option.title}${t("entry.unpublished")}`;
/** The picker's options and the names of its picked values, from a server search (`useRelationSearch`). Leaves out the entry being edited. */
function relationOptions(t, search, selfId) {
    const option = (entry) => ({ value: entry.id, label: entryLabel(t, entry) });
    return {
        options: (search.options ?? []).filter((entry) => entry.id !== selfId).map(option),
        known: search.known.map(option),
    };
}
/** The failure of a search, under the input like the other relation inputs. */
function SearchError({ failed }) {
    const t = useTranslator(entriesMessages);
    return failed ? (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: t("entry.loadFailed") })) : null;
}
/** Single relation. Typing searches the target entries on the server (best title matches first); pressing shows the first ones. */
export function EntryPicker({ field, id, value, invalid, describedBy, context, onChange }) {
    const site = useSite();
    const t = useTranslator(entriesMessages);
    const relation = field;
    const selected = typeof value === "string" && value ? [value] : [];
    const search = useRelationSearch({ collection: relation.to, publishedOnly: relation.publishedOnly, selected });
    const waiting = search.options === null && !search.error;
    return (_jsxs(_Fragment, { children: [_jsx(RelationCombobox, { id: id, "aria-label": field.label, placeholder: waiting ? t("loading") : (relation.placeholder ?? t("entry.choose", { target: targetLabel(site, relation) })), invalid: invalid, describedBy: describedBy, disabled: context.disabled || waiting, multiple: false, ...relationOptions(t, search, context.entryId), onSearch: search.search, loading: search.loading, value: selected, onValueChange: (next) => onChange(next[0] ?? null) }), _jsx(SearchError, { failed: search.error })] }));
}
/** One row of an ordered list. Move it by dragging the handle or with the up/down buttons. */
function SortableEntryRow({ sortableId, index, count, option, disabled, onMove, onRemove, }) {
    const t = useTranslator(entriesMessages);
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: sortableId,
        disabled,
    });
    const title = option?.title ?? t("loading");
    return (_jsxs("li", { ref: setNodeRef, style: { transform: CSS.Transform.toString(transform), transition }, className: cn("flex items-center gap-1 rounded-md border bg-cms-background px-1 py-1 text-xs", isDragging && "relative z-10 shadow-md"), children: [_jsx(IconButton, { ref: setActivatorNodeRef, size: "icon-xs", label: t("entry.drag", { title }), disabled: disabled, className: "cursor-grab touch-none text-cms-muted-foreground active:cursor-grabbing", ...attributes, ...listeners, children: _jsx(GripVertical, {}) }), _jsxs("span", { className: "min-w-0 flex-1 truncate", children: [index + 1, ". ", title, option && option.status !== "published" && option.status !== "missing" && (_jsx("span", { className: "ml-1 cms-dark:text-amber-400 text-amber-700", children: t("entry.unpublished") }))] }), _jsx(IconButton, { size: "icon-xs", label: t("entry.up", { title }), disabled: disabled || index === 0, onClick: () => onMove(-1), children: _jsx(ArrowUp, {}) }), _jsx(IconButton, { size: "icon-xs", label: t("entry.down", { title }), disabled: disabled || index === count - 1, onClick: () => onMove(1), children: _jsx(ArrowDown, {}) }), _jsx(IconButton, { size: "icon-xs", label: t("entry.remove", { title }), disabled: disabled, onClick: onRemove, children: _jsx(X, {}) })] }));
}
/**
 * Ordered multi relation (post targets). Used by collection items.
 * Check posts in the `Add/remove posts` list above to add or remove them (added ones go to the end), and drag in the list below to reorder.
 */
export function OrderedEntryList({ field, id, value, context, onChange }) {
    const site = useSite();
    const t = useTranslator(entriesMessages);
    const relation = field;
    const ids = Array.isArray(value) ? value : [];
    const search = useRelationSearch({ collection: relation.to, publishedOnly: relation.publishedOnly, selected: ids });
    const waiting = search.options === null && !search.error;
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    // The same post can be added twice (legacy data), so the index is also used as the drag ID.
    const sortableIds = ids.map((itemId, index) => `${index}:${itemId}`);
    const move = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= ids.length)
            return;
        onChange(arrayMove([...ids], index, target));
    };
    const onDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id)
            return;
        onChange(arrayMove([...ids], sortableIds.indexOf(String(active.id)), sortableIds.indexOf(String(over.id))));
    };
    /** Selection returned by the checklist. Remaining posts keep the current order and new posts are appended. */
    const applySelection = (selected) => {
        const chosen = new Set(selected);
        const kept = ids.filter((itemId) => chosen.has(itemId));
        onChange([...kept, ...selected.filter((itemId) => !ids.includes(itemId))]);
    };
    const target = targetLabel(site, relation);
    /** The row of a post that was looked up and is not there (deleted, trashed). Before the lookup answers, the row says it is loading. */
    const rowOf = (itemId) => search.entryOf(itemId) ??
        (search.isMissing(itemId)
            ? { id: itemId, title: t("entry.missing", { target }), slug: null, status: "missing" }
            : undefined);
    return (_jsxs("div", { className: "space-y-2", children: [_jsx(RelationCombobox, { id: id, "aria-label": t("entry.editList", { target }), placeholder: waiting ? t("loading") : (relation.placeholder ?? t("entry.editList", { target })), disabled: context.disabled || waiting, multiple: true, showChips: false, ...relationOptions(t, search, context.entryId), onSearch: search.search, loading: search.loading, value: ids, onValueChange: applySelection }), _jsx(SearchError, { failed: search.error }), ids.length === 0 ? (_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("entry.empty", { target }) })) : (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: onDragEnd, children: _jsx(SortableContext, { items: sortableIds, strategy: verticalListSortingStrategy, children: _jsx("ol", { "aria-label": t("entry.listAria", { target }), className: "space-y-1", children: ids.map((itemId, index) => (_jsx(SortableEntryRow, { sortableId: sortableIds[index], index: index, count: ids.length, option: rowOf(itemId), disabled: context.disabled, onMove: (direction) => move(index, direction), onRemove: () => onChange(ids.filter((_, i) => i !== index)) }, sortableIds[index]))) }) }) }))] }));
}
/**
 * If an inverse relation is a conditional list on the other record (a field that exists only for one value of a select field),
 * only records matching that condition can be picked. The currently chosen kind is read per record to filter.
 * Relations without a condition are not filtered.
 */
function useRecordKind(field, options) {
    const site = useSite();
    const requirement = site.storedField(field.from, field.via)?.when;
    const discriminant = requirement
        ? site.storedField(field.from, requirement.field)?.field
        : undefined;
    const defaultValue = discriminant?.kind === "select" ? discriminant.defaultValue : undefined;
    const [kinds, setKinds] = useState(new Map());
    const idsKey = options.map((option) => option.id).join(",");
    // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the option ids
    useEffect(() => {
        if (!requirement)
            return;
        const missing = options.filter((option) => !kinds.has(option.id));
        if (missing.length === 0)
            return;
        let cancelled = false;
        void Promise.all(missing.map((option) => cmsFetch(site, cmsApiUrl(`/v1/entries/${option.id}`))
            .then((record) => {
            const value = record.working.metadata[requirement.field];
            return [option.id, typeof value === "string" ? value : (defaultValue ?? "")];
        })
            .catch(() => [option.id, ""]))).then((loaded) => {
            if (!cancelled)
                setKinds((current) => new Map([...current, ...loaded]));
        });
        return () => {
            cancelled = true;
        };
    }, [idsKey, requirement?.field]);
    return {
        ready: !requirement || options.every((option) => kinds.has(option.id)),
        accepts: (id) => !requirement || kinds.get(id) === requirement.value,
        /** Sets the kind so a newly created record accepts this relation. Not written separately for the default kind. */
        createMetadata: requirement && requirement.value !== defaultValue ? { [requirement.field]: requirement.value } : {},
    };
}
/**
 * Inverse relation input. E.g. a post's `collection`. Saves the other record's (collection's) multi relation field (`itemIds`)
 * immediately on click, independent of this post's draft and publish. Adding appends to the end; removing removes every slot holding this post.
 * If versions diverge (changed elsewhere first), it re-reads the latest value and tries once more.
 */
export function BacklinkInput({ field, targetId, disabled, shared, }) {
    const site = useSite();
    const t = useTranslator(entriesMessages);
    // The records come from a server search (published ones, like the old list). A conditional list keeps only the records of one kind, which is
    // known per record, so it asks for more hits to leave enough after that filter.
    const conditional = Boolean(site.storedField(field.from, field.via)?.when);
    const records = useRelationSearch({
        collection: field.from,
        publishedOnly: true,
        limit: conditional ? 50 : undefined,
        enabled: Boolean(targetId),
    });
    const creator = useRecordCreator();
    const kind = useRecordKind(field, records.options ?? []);
    const [fetched, setFetched] = useState(null);
    /** Load/save failure. Shown right below the input like other relation inputs. */
    const [error, setError] = useState(null);
    const membersOf = useCallback((references) => {
        const found = new Map();
        for (const reference of references) {
            const viaField = reference.occurrences.some((occurrence) => occurrence.path === field.via);
            if (reference.state === "working" && reference.sourceCollection === field.from && viaField) {
                found.set(reference.sourceId, reference.sourceTitle || t("untitled"));
            }
        }
        return [...found].map(([id, title]) => ({ id, title }));
    }, [field.from, field.via, t]);
    const refreshShared = shared?.refresh;
    const load = useCallback(async () => {
        if (!targetId)
            return;
        if (refreshShared) {
            refreshShared();
            return;
        }
        try {
            const data = await cmsFetch(site, cmsApiUrl(`/v1/entries/${targetId}/relations`));
            setFetched(membersOf(data.incomingReferences));
        }
        catch (loadError) {
            setError(errorText(site, loadError, t("entry.loadFailed")));
        }
    }, [targetId, refreshShared, membersOf, site, t]);
    // If the properties panel already loaded this post's usages, do not fetch separately.
    const usesShared = Boolean(shared);
    useEffect(() => {
        if (!usesShared)
            void load();
    }, [usesShared, load]);
    const members = shared
        ? shared.loading && shared.references.length === 0
            ? null
            : membersOf(shared.references)
        : fetched;
    /** Changes the other record's relation list and saves immediately. For a record collection, saving is publishing. */
    const update = async (recordId, change) => {
        for (let attempt = 0; attempt < 2; attempt++) {
            const record = await cmsFetch(site, cmsApiUrl(`/v1/entries/${recordId}`));
            const current = record.working.metadata[field.via];
            const ids = Array.isArray(current) ? current.filter((id) => typeof id === "string") : [];
            try {
                await cmsFetch(site, cmsApiUrl(`/v1/entries/${recordId}`), {
                    method: "PATCH",
                    json: {
                        expectedVersion: record.version,
                        slug: record.workingSlug,
                        metadata: { ...record.working.metadata, [field.via]: change(ids) },
                    },
                    fallback: t("saveFailed"),
                });
                return;
            }
            catch (saveError) {
                if (!(saveError instanceof CmsApiError && saveError.code === "conflict") || attempt === 1)
                    throw saveError;
            }
        }
    };
    // On pick or remove, reflect on screen first (optimistic) and save in turn in the background. On failure, notify and revert only that change.
    const [optimistic, setOptimistic] = useState(null);
    const pendingRef = useRef(0);
    const queueRef = useRef(Promise.resolve());
    const awaitingServerRef = useRef(false);
    /** Collection just created with this post in it. Not saved again. */
    const createdRef = useRef(new Set());
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
    const enqueue = (task, failure, revert) => {
        pendingRef.current += 1;
        queueRef.current = queueRef.current.then(async () => {
            try {
                await task();
            }
            catch (taskError) {
                setError(errorText(site, taskError, failure));
                setOptimistic((current) => revert(current ?? serverIdsRef.current));
            }
            finally {
                pendingRef.current -= 1;
                if (pendingRef.current === 0) {
                    awaitingServerRef.current = true;
                    await load();
                }
            }
        });
    };
    if (!targetId) {
        return _jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("backlink.saveDraft", { label: field.label }) });
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
    const change = (next) => {
        setError(null);
        const added = next.filter((id) => !shown.includes(id) && !createdRef.current.delete(id));
        const removed = shown.filter((id) => !next.includes(id));
        setOptimistic(next);
        for (const recordId of added) {
            enqueue(() => update(recordId, (ids) => (ids.includes(targetId) ? ids : [...ids, targetId])), t("backlink.addFailed", { label: field.label }), (ids) => ids.filter((id) => id !== recordId));
        }
        for (const recordId of removed) {
            enqueue(() => update(recordId, (ids) => ids.filter((id) => id !== targetId)), t("backlink.removeFailed", { label: field.label }), (ids) => (ids.includes(recordId) ? ids : [...ids, recordId]));
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx(RelationCombobox, { multiple: true, "aria-label": field.label, placeholder: members === null || records.options === null ? t("loading") : t("relation.searchOrAdd"), options: options, known: known, onSearch: records.search, loading: records.loading || !kind.ready, value: shown, disabled: disabled || members === null || (records.options === null && !records.error), onValueChange: change, onCreate: field.createInline
                    ? async (title) => {
                        // Open with this post already in the add field. After saving, reload the options so it shows up in the list right away.
                        const saved = await creator.create(field.from, title, {
                            ...kind.createMetadata,
                            [field.via]: [targetId],
                        });
                        if (!saved)
                            return null;
                        createdRef.current.add(saved.id);
                        records.remember({ ...optionOf(site, t, field.from, saved), status: saved.status });
                        awaitingServerRef.current = true;
                        void load();
                        return saved.id;
                    }
                    : undefined }), error && (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: error })), _jsx(SearchError, { failed: records.error }), creator.sheet] }));
}
