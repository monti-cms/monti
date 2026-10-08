"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils/cn.js";
import { Button } from "../../ui/button.js";
import { Checkbox } from "../../ui/checkbox.js";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../ui/command.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";
import { cmsFetch, errorText } from "../admin-api.js";
import { cmsIssueMessage } from "../api-error-message.js";
import { ConfirmDialog } from "../shared/confirm-dialog.js";
import { nounVars } from "../shared/noun.messages.js";
import { useTaxonomyOptions } from "../shared/use-taxonomy.js";
import { bulkBarMessages } from "./bulk-bar.messages.js";
/**
 * Actions per category field (tags, categories, etc.) of the collection. Fields that hold many get add/remove; a field that holds only one gets replace.
 * Multi-value field actions come first.
 */
export function taxonomyActions(site, collection) {
    const t = site.createTranslator(bulkBarMessages);
    const noun = nounVars(site, collection);
    const fields = site
        .taxonomyFieldsOf(collection)
        .flatMap((stored) => stored.field.kind === "relation"
        ? [{ name: stored.name, label: stored.field.label, many: stored.field.many === true }]
        : []);
    const action = (op, field, ask) => ({
        value: `${op}:${field.name}`,
        label: t(op, { label: field.label }),
        ask,
        relation: { op, field: field.name, label: field.label, many: field.many },
    });
    return [
        ...fields
            .filter((field) => field.many)
            .flatMap((field) => [
            action("relation.add", field, (count, target) => t("ask.relation.add", { count, ...noun, label: field.label, target: target ?? "" })),
            action("relation.remove", field, (count, target) => t("ask.relation.remove", { count, ...noun, label: field.label, target: target ?? "" })),
        ]),
        ...fields
            .filter((field) => !field.many)
            .map((field) => action("relation.set", field, (count, target) => target === null
            ? t("ask.relation.clear", { count, ...noun, label: field.label })
            : t("ask.relation.set", { count, ...noun, label: field.label, target }))),
    ];
}
const listActions = (t, noun) => [
    {
        value: "folder.move",
        label: t("folder.move"),
        ask: (count, target) => target === null ? t("ask.folder.root", { count }) : t("ask.folder.move", { count, target }),
    },
    { value: "publish", label: t("publish"), ask: (count) => t("ask.publish", { count, ...noun }), content: true },
    { value: "archive", label: t("archive"), ask: (count) => t("ask.archive", { count, ...noun }), content: true },
    { value: "unarchive", label: t("unarchive"), ask: (count) => t("ask.unarchive", { count, ...noun }), content: true },
    { value: "trash", label: t("trash"), ask: (count) => t("ask.trash", { count }), destructive: true },
];
const trashActions = (t) => [
    {
        value: "permanentDelete",
        label: t("permanentDelete"),
        ask: (count) => t("ask.permanentDelete", { count }),
        destructive: true,
    },
];
/** Failure reason per action ("distinguish success from failure and rerun only failed items"). Only codes in the dictionary have text. */
const FAILURE_CODES = new Set([
    "conflict",
    "not_found",
    "invalid_input",
    "invalid_status",
    "publish_validation_failed",
    "slug_conflict",
    "in_use",
    "invalid_reference",
]);
/** Reason for a single failure. If a usage blocked permanent deletion, names it as `In use: <name>`. */
export function describeBulkFailure(site, failure) {
    const t = site.createTranslator(bulkBarMessages);
    if (failure.error === "in_use" && failure.usages?.length) {
        const names = [...new Set(failure.usages.map((usage) => usage.title || t("untitled")))];
        const shown = names.slice(0, 3).join(", ");
        return t("failure.usedBy", {
            names: names.length > 3 ? t("failure.more", { names: shown, more: names.length - 3 }) : shown,
        });
    }
    const base = FAILURE_CODES.has(failure.error) ? t(`failure.${failure.error}`) : failure.error;
    return failure.issues?.length
        ? `${base} ${failure.issues
            .slice(0, 3)
            .map((issue) => cmsIssueMessage(site, issue))
            .join(" ")}`
        : base;
}
export async function runBulk(site, op, items, params = {}) {
    const data = await cmsFetch(site, cmsApiUrl("/v1/bulk"), {
        method: "POST",
        json: { op, items: items.map(({ id, expectedVersion }) => ({ id, expectedVersion })), ...params },
        fallback: site.createTranslator(bulkBarMessages)("requestFailed"),
    });
    return data.results;
}
/**
 * Multi-category (tags, etc.) picker in the bulk action row. A single small button like the folder and category pickers; pressing it opens search and a checklist.
 * The button shows picked items shortened like `React +2`, so the row does not overflow.
 */
function ManyPicker({ label, options, value, onValueChange, }) {
    const t = useTranslator(bulkBarMessages);
    const names = value.map((id) => options.find((option) => option.id === id)?.title ?? id);
    const summary = names.length === 0
        ? t("picker.select", { label })
        : names.length === 1
            ? names[0]
            : t("picker.more", { first: names[0] ?? "", more: names.length - 1 });
    const toggle = (id) => onValueChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
    return (_jsxs(Popover, { children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { type: "button", variant: "outline", size: "sm", "aria-label": t("picker.aria", { label, names: names.length === 0 ? t("picker.none") : names.join(", ") }), className: cn("max-w-56 justify-between gap-1.5 font-normal", names.length === 0 && "text-cms-muted-foreground") }), children: [_jsx("span", { className: "truncate", children: summary }), _jsx(ChevronDownIcon, { "aria-hidden": true, className: "size-4 text-cms-muted-foreground" })] }), _jsx(PopoverContent, { align: "start", className: "w-64 p-0", children: _jsxs(Command, { children: [_jsx(CommandInput, { placeholder: t("picker.search", { label }), "aria-label": t("picker.search", { label }) }), _jsxs(CommandList, { className: "max-h-64", children: [_jsx(CommandEmpty, { children: t("picker.empty", { label }) }), _jsx(CommandGroup, { children: options.map((option) => (_jsxs(CommandItem, { value: `${option.title} ${option.id}`, onSelect: () => toggle(option.id), children: [_jsx(Checkbox, { checked: value.includes(option.id), tabIndex: -1, "aria-hidden": true, className: "pointer-events-none" }), option.title] }, option.id))) })] })] }) })] }));
}
/**
 * Bulk actions. Apply only to items picked on the current page and show a result per item.
 * Only failed items can be rerun. The trash screen (`mode="trash"`) offers only bulk permanent delete.
 */
export function BulkBar({ collection, selected, folders, mode = "list", onClearSelection, onRun, onDone, }) {
    const site = useSite();
    const t = useTranslator(bulkBarMessages);
    const isRecord = site.isItemCollection(collection);
    const actions = useMemo(() => mode === "trash"
        ? trashActions(t)
        : [
            ...taxonomyActions(site, collection),
            ...listActions(t, nounVars(site, collection)).filter((action) => !action.content || !isRecord),
        ], [isRecord, collection, mode, site, t]);
    const [action, setAction] = useState(actions[0]?.value ?? "trash");
    const [checked, setChecked] = useState([]);
    const [single, setSingle] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState(null);
    const [ranItems, setRanItems] = useState([]);
    const [error, setError] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const options = useTaxonomyOptions(collection, mode === "list");
    useEffect(() => {
        if (!actions.some((candidate) => candidate.value === action))
            setAction(actions[0]?.value ?? "trash");
    }, [actions, action]);
    // Changing the action clears that action's input value.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed by action
    useEffect(() => {
        setChecked([]);
        setSingle("");
        setError(null);
    }, [action]);
    const activeAction = actions.find((candidate) => candidate.value === action);
    const relation = activeAction?.relation;
    const needsMany = relation !== undefined && relation.op !== "relation.set";
    const needsSingle = relation?.op === "relation.set" || action === "folder.move";
    const relationOptions = relation ? (options[relation.field] ?? []) : [];
    const canRun = !isRunning && selected.length > 0 && (needsMany ? checked.length > 0 : needsSingle ? single !== "" : true);
    const run = async (items) => {
        setIsRunning(true);
        setError(null);
        try {
            const params = needsMany
                ? { field: relation.field, ids: checked }
                : relation
                    ? { field: relation.field, id: single === "__none__" ? null : single }
                    : action === "folder.move"
                        ? { folderId: single === "__unfiled__" ? null : single }
                        : {};
            const out = await (onRun ?? ((...args) => runBulk(site, ...args)))(relation?.op ?? action, items, params);
            setResults(out);
            setRanItems(items);
            onDone?.(out.filter((result) => !result.ok).map((result) => result.id));
        }
        catch (err) {
            setError(errorText(site, err, t("failed")));
        }
        finally {
            setIsRunning(false);
        }
    };
    /** Name of the picked target. For categories, the picked names; for a folder, the folder name. `null` for a clearing selection. */
    const targetName = () => {
        const titleOf = (id) => relationOptions.find((option) => option.id === id)?.title ?? id;
        if (needsMany)
            return checked.map(titleOf).join(", ");
        if (relation)
            return single === "__none__" ? null : titleOf(single);
        if (action === "folder.move")
            return single === "__unfiled__" ? null : (folders.find((folder) => folder.id === single)?.name ?? single);
        return null;
    };
    // Actions that change many items at once always ask.
    const start = () => {
        if (!activeAction)
            return;
        setConfirm({
            title: activeAction.label,
            description: activeAction.ask(selected.length, targetName()),
            confirmLabel: activeAction.label,
            destructive: activeAction.destructive,
            onConfirm: () => run(selected),
        });
    };
    const failures = (results ?? []).filter((result) => !result.ok);
    const successes = (results ?? []).length - failures.length;
    const titleOf = (id) => ranItems.find((item) => item.id === id)?.title || id.slice(0, 8);
    if (selected.length === 0 && !results)
        return null;
    const singleItems = relation
        ? [
            { value: "__none__", label: t("option.none") },
            ...relationOptions.map((option) => ({ value: option.id, label: option.title })),
        ]
        : [
            { value: "__unfiled__", label: t("option.root") },
            ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
        ];
    return (_jsxs("section", { "aria-label": t("bar"), className: "border-b bg-cms-primary/5 px-5 py-2", children: [_jsxs("div", { className: "flex min-h-7 flex-wrap items-center gap-2 text-sm", children: [_jsx("span", { className: "font-medium text-cms-primary", children: t("count", { count: selected.length }) }), _jsx(Button, { type: "button", variant: "ghost", size: "xs", onClick: onClearSelection, children: t("clear") }), actions.length > 1 ? (_jsxs(Select, { value: action, items: actions.map((candidate) => ({ value: candidate.value, label: candidate.label })), onValueChange: (value) => value && setAction(value), children: [_jsx(SelectTrigger, { size: "sm", "aria-label": t("kind"), children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: actions.map((candidate) => (_jsx(SelectItem, { value: candidate.value, children: candidate.label }, candidate.value))) })] })) : null, needsMany && (_jsx(ManyPicker, { label: relation.label, options: relationOptions, value: checked, onValueChange: setChecked })), needsSingle && (_jsxs(Select, { value: single || null, items: singleItems, onValueChange: (value) => setSingle(typeof value === "string" ? value : ""), children: [_jsx(SelectTrigger, { size: "sm", "aria-label": relation ? t("target.aria", { label: relation.label }) : t("folder.aria"), children: _jsx(SelectValue, { placeholder: relation ? t("picker.select", { label: relation.label }) : t("folder.select") }) }), _jsx(SelectContent, { children: singleItems.map((item) => (_jsx(SelectItem, { value: item.value, children: item.label }, item.value))) })] })), _jsx(Button, { type: "button", size: "sm", variant: activeAction?.destructive ? "destructive" : "default", disabled: !canRun, onClick: start, children: isRunning ? t("running") : (activeAction?.label ?? t("run")) }), results && (_jsx("output", { className: "text-cms-muted-foreground text-xs", children: t("result", { success: successes, failed: failures.length }) })), failures.length > 0 && (_jsx(Button, { type: "button", variant: "outline", size: "xs", onClick: () => void run(ranItems.filter((item) => failures.some((failure) => failure.id === item.id))), children: t("retry") }))] }), error && (_jsx("p", { role: "alert", className: "pt-2 text-cms-destructive text-xs", children: error })), failures.length > 0 && (_jsx("ul", { className: "flex flex-col gap-1 pt-2 text-cms-destructive text-xs", children: failures.map((failure) => (_jsxs("li", { children: [_jsx("span", { className: "font-medium", children: titleOf(failure.id) }), " \u2014 ", describeBulkFailure(site, failure)] }, failure.id))) })), _jsx(ConfirmDialog, { request: confirm, onClose: () => setConfirm(null) })] }));
}
