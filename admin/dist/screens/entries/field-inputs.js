"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cmsApiUrl, isCollection, schemaOf, storedField } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { IconButton } from "../../ui/icon-button.js";
import { CmsApiError, cmsFetch, errorText } from "../admin-api.js";
import { useTaxonomy } from "../shared/use-taxonomy.js";
import { useRecordCreator } from "./record-create-sheet.js";
import { RelationCombobox } from "./relation-combobox.js";
import { t } from "./translate.js";
export const inputClass = "h-8 text-xs md:text-xs";
/** Row count of a multi-line text input (`rows`, 2 if absent) and the minimum height that shows that many rows (text lines + vertical padding). */
export function multilineProps(field) {
    const rows = field.rows !== undefined && field.rows >= 1 ? Math.floor(field.rows) : 2;
    return { rows, style: { minHeight: `${rows + 1}rem` } };
}
/** Maximum count received per list API call. If there are more posts, they are fetched in several batches. */
const ENTRY_OPTIONS_PAGE_SIZE = 100;
/**
 * Full list of relation targets (posts, memos). Fetched all at once up front so it can be shown right away without search when picking.
 * The list API excludes trashed posts, and with `publishedOnly` only published posts are received.
 */
function useEntryOptions(field) {
    const [options, setOptions] = useState(null);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const all = [];
            for (let page = 1;; page += 1) {
                const params = new URLSearchParams({
                    collection: field.to,
                    pageSize: String(ENTRY_OPTIONS_PAGE_SIZE),
                    page: String(page),
                });
                if (field.publishedOnly)
                    params.set("status", "published");
                const data = await cmsFetch(cmsApiUrl(`/v1/entries?${params}`));
                all.push(...data.items.map((item) => ({ id: item.id, title: item.title || t("untitled"), status: item.status })));
                if (data.items.length === 0 || all.length >= data.total)
                    break;
            }
            return all;
        };
        load()
            .then((loaded) => !cancelled && setOptions(loaded))
            .catch(() => !cancelled && setOptions([]));
        return () => {
            cancelled = true;
        };
    }, [field.to, field.publishedOnly]);
    return options;
}
/** Label of the relation target collection (e.g. `Posts`). Used in input hint text. */
const targetLabel = (relation) => isCollection(relation.to) ? schemaOf(relation.to).label : relation.to;
/** Posts that are not published get a marker after the name, because they are missing from the public list of collections and replacement posts. */
const entryLabel = (option) => option.status === "published" ? option.title : `${option.title}${t("entry.unpublished")}`;
/** Single relation (post or memo target). Pressing it opens the full post list to pick from. Used by the replacement post. */
export function EntryPicker({ field, id, value, invalid, describedBy, context, onChange }) {
    const relation = field;
    const options = useEntryOptions(relation);
    const selected = typeof value === "string" && value ? [value] : [];
    return (_jsx(RelationCombobox, { id: id, "aria-label": field.label, placeholder: options === null ? t("loading") : (relation.placeholder ?? t("entry.choose", { target: targetLabel(relation) })), invalid: invalid, describedBy: describedBy, disabled: context.disabled || options === null, multiple: false, options: (options ?? [])
            .filter((option) => option.id !== context.entryId)
            .map((option) => ({ value: option.id, label: entryLabel(option) })), value: selected, onValueChange: (next) => onChange(next[0] ?? null) }));
}
/** One row of an ordered list. Move it by dragging the handle or with the up/down buttons. */
function SortableEntryRow({ sortableId, index, count, option, disabled, onMove, onRemove, }) {
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
    const relation = field;
    const options = useEntryOptions(relation);
    const ids = Array.isArray(value) ? value : [];
    const byId = useMemo(() => new Map((options ?? []).map((option) => [option.id, option])), [options]);
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
    const target = targetLabel(relation);
    const missing = (itemId) => options === null ? undefined : { id: itemId, title: t("entry.missing", { target }), status: "missing" };
    return (_jsxs("div", { className: "space-y-2", children: [_jsx(RelationCombobox, { id: id, "aria-label": t("entry.editList", { target }), placeholder: options === null ? t("loading") : (relation.placeholder ?? t("entry.editList", { target })), disabled: context.disabled || options === null, multiple: true, showChips: false, options: (options ?? [])
                    .filter((option) => option.id !== context.entryId)
                    .map((option) => ({ value: option.id, label: entryLabel(option) })), value: ids, onValueChange: applySelection }), ids.length === 0 ? (_jsx("p", { className: "text-cms-muted-foreground text-xs", children: t("entry.empty", { target }) })) : (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: onDragEnd, children: _jsx(SortableContext, { items: sortableIds, strategy: verticalListSortingStrategy, children: _jsx("ol", { "aria-label": t("entry.listAria", { target }), className: "space-y-1", children: ids.map((itemId, index) => (_jsx(SortableEntryRow, { sortableId: sortableIds[index], index: index, count: ids.length, option: byId.get(itemId) ?? missing(itemId), disabled: context.disabled, onMove: (direction) => move(index, direction), onRemove: () => onChange(ids.filter((_, i) => i !== index)) }, sortableIds[index]))) }) }) }))] }));
}
/**
 * If an inverse relation is a conditional list on the other record (e.g. `memoIds`, present only when a collection's `contained posts` are memos),
 * only records matching that condition can be picked. The currently chosen kind is read per record to filter.
 * Relations without a condition are not filtered.
 */
function useRecordKind(field, options) {
    const requirement = storedField(field.from, field.via)?.when;
    const discriminant = requirement ? storedField(field.from, requirement.field)?.field : undefined;
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
        void Promise.all(missing.map((option) => cmsFetch(cmsApiUrl(`/v1/entries/${option.id}`))
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
    const records = useTaxonomy(field.from, Boolean(targetId));
    const creator = useRecordCreator();
    const kind = useRecordKind(field, records.options);
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
    }, [field.from, field.via]);
    const refreshShared = shared?.refresh;
    const load = useCallback(async () => {
        if (!targetId)
            return;
        if (refreshShared) {
            refreshShared();
            return;
        }
        try {
            const data = await cmsFetch(cmsApiUrl(`/v1/entries/${targetId}/relations`));
            setFetched(membersOf(data.incomingReferences));
        }
        catch (loadError) {
            setError(errorText(loadError, t("entry.loadFailed")));
        }
    }, [targetId, refreshShared, membersOf]);
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
            const record = await cmsFetch(cmsApiUrl(`/v1/entries/${recordId}`));
            const current = record.working.metadata[field.via];
            const ids = Array.isArray(current) ? current.filter((id) => typeof id === "string") : [];
            try {
                await cmsFetch(cmsApiUrl(`/v1/entries/${recordId}`), {
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
                setError(errorText(taskError, failure));
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
    const options = [
        ...records.options
            .filter((option) => kind.accepts(option.id))
            .map((option) => ({ value: option.id, label: option.title })),
        // A collection not yet in the public list (e.g. just created) is also shown by name.
        ...(members ?? [])
            .filter((member) => !records.options.some((option) => option.id === member.id))
            .map((member) => ({ value: member.id, label: member.title })),
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
    return (_jsxs(_Fragment, { children: [_jsx(RelationCombobox, { multiple: true, "aria-label": field.label, placeholder: members === null || !kind.ready ? t("loading") : t("relation.searchOrAdd"), options: options, value: shown, disabled: disabled || members === null || !kind.ready, onValueChange: change, onCreate: field.createInline
                    ? async (title) => {
                        // Open with this post already in the add field. After saving, reload the options so it shows up in the list right away.
                        const saved = await creator.create(field.from, {
                            title,
                            ...kind.createMetadata,
                            [field.via]: [targetId],
                        });
                        if (!saved)
                            return null;
                        createdRef.current.add(saved.id);
                        void records.reload();
                        awaitingServerRef.current = true;
                        void load();
                        return saved.id;
                    }
                    : undefined }), error && (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: error })), creator.sheet] }));
}
