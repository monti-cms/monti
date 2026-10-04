"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { errorText } from "@monti-cms/admin/api";
import { Button, Popover, PopoverContent, PopoverTrigger, Textarea } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { Languages, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { runAiActionMany, useAiActions } from "./ai-slot-provider.js";
import { aiTranslateMessages } from "./ai-translate.messages.js";
import { applyTranslation, collectUnits, unitAt } from "./ai-translate-units.js";
import { OptionSelect } from "./custom-editor.js";
const t = createTranslator(aiTranslateMessages);
/**
 * AI translation in the translation editor. A block that still has a notice (`untranslated`) is a "not yet translated place".
 * Translation is a regular AI action. It calls, per block, the actions whose attach target is `translation` (inputs `block`, `from`, `to`; MDX result).
 * If there are several such actions, each gets a button next to the block handle, and Translate all lets you pick the action.
 * It sends the block's source MDX (with notice markers stripped), and when the server returns only MDX that passed translation and structure checks, the block is replaced.
 * A block that fails the checks stays as a notice. Translation units and replacement rules live in `ai-translate-units.ts`.
 */
/** Number of blocks and characters sent per request (kept below the server limits). */
const BATCH_BLOCKS = 4;
const BATCH_CHARS = 12_000;
/** Number of concurrent requests. */
const PARALLEL_REQUESTS = 2;
async function requestTranslation(action, blocks, locales, request, signal) {
    const results = await runAiActionMany(action, blocks.map((block) => ({ block: block.mdx, from: locales.sourceLocale, to: locales.targetLocale })), { request, signal, env: { locale: locales.targetLocale } });
    return results.map((item, index) => {
        const id = blocks[index]?.id ?? "";
        return "error" in item ? { id, error: item.error } : { id, mdx: "text" in item.result ? item.result.text : "" };
    });
}
/** Groups blocks into request units. A large block is not split; it is sent alone. */
function batches(blocks) {
    const groups = [];
    let current = [];
    let chars = 0;
    for (const block of blocks) {
        if (current.length > 0 && (current.length >= BATCH_BLOCKS || chars + block.mdx.length > BATCH_CHARS)) {
            groups.push(current);
            current = [];
            chars = 0;
        }
        current.push(block);
        chars += block.mdx.length;
    }
    if (current.length > 0)
        groups.push(current);
    return groups;
}
/**
 * AI translation behavior in the translation editor. `blockActions` are the translation actions next to the block handle (one per action, named by the action name),
 * and `toolbar` is Translate all in the toolbar. If there is no usable translation action, both are absent.
 */
export function useAiTranslate(locales) {
    const { data } = useAiActions(locales !== null);
    const features = useMemo(() => locales
        ? (data?.items ?? []).filter((item) => item.enabled &&
            item.result === "mdx" &&
            item.attach.some((attach) => attach.slot === "translation") &&
            data?.usable.includes(item.key))
        : [], [data, locales]);
    /** Action to use for Translate all. If the chosen action is gone, it is the first action. */
    const [chosenKey, setChosenKey] = useState(null);
    const feature = features.find((item) => item.key === chosenKey) ?? features[0];
    const actionKey = feature?.key ?? "";
    const editorRef = useRef(null);
    const [busyBlocks, setBusyBlocks] = useState(new Set());
    const [progress, setProgress] = useState(null);
    const [request, setRequest] = useState("");
    const [open, setOpen] = useState(false);
    const abortRef = useRef(null);
    /** Requests that translate one block at a time. Stop in the toolbar stops them too. */
    const blockAbortRef = useRef(new Map());
    const setEditor = useCallback((editor) => {
        editorRef.current = editor;
    }, []);
    /** Stops all translations in progress (Translate all and block translation). */
    const stop = useCallback(() => {
        abortRef.current?.abort();
        for (const controller of blockAbortRef.current.values())
            controller.abort();
    }, []);
    // Leaving the edit screen stops translations in progress.
    useEffect(() => stop, [stop]);
    const translateOne = useCallback(async (editor, pos, action) => {
        if (!locales)
            return;
        const unit = unitAt(editor.state.doc, pos);
        if (!unit)
            return;
        // Block translation does not use the toolbar's extra request (that request applies only to Translate all).
        blockAbortRef.current.get(pos)?.abort();
        const controller = new AbortController();
        blockAbortRef.current.set(pos, controller);
        setBusyBlocks((current) => new Set([...current, pos]));
        try {
            const [result] = await requestTranslation(action, [{ id: "b0", mdx: unit.mdx }], locales, "", controller.signal);
            if (!result || controller.signal.aborted)
                return;
            if ("error" in result) {
                toast.error(t("toast.failedOne", { reason: result.error }));
                return;
            }
            const applied = applyTranslation(editor, unit, result.mdx, pos);
            if (applied === "changed")
                toast.message(t("toast.blockChanged"));
            else if (applied === "invalid")
                toast.error(t("toast.invalidOne"));
        }
        catch (error) {
            if (controller.signal.aborted)
                toast.message(t("toast.stopped"));
            else
                toast.error(errorText(error, t("runFailed")));
        }
        finally {
            if (blockAbortRef.current.get(pos) === controller)
                blockAbortRef.current.delete(pos);
            setBusyBlocks((current) => new Set([...current].filter((item) => item !== pos)));
        }
    }, [locales]);
    const translateAll = useCallback(async () => {
        const editor = editorRef.current;
        if (!editor || !locales)
            return;
        const blocks = collectUnits(editor.state.doc).map((unit, index) => ({
            ...unit,
            id: `b${index}`,
        }));
        if (blocks.length === 0) {
            toast.message(t("toast.noBlocks"));
            return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        setOpen(false);
        setProgress({ done: 0, total: blocks.length });
        const groups = batches(blocks);
        const failures = [];
        let skipped = 0;
        let fatal = null;
        let next = 0;
        const worker = async () => {
            while (next < groups.length && !controller.signal.aborted && !fatal) {
                const group = groups[next++] ?? [];
                try {
                    const results = await requestTranslation(actionKey, group.map(({ id, mdx }) => ({ id, mdx })), locales, request, controller.signal);
                    for (const result of results) {
                        const block = group.find((item) => item.id === result.id);
                        if (!block)
                            continue;
                        if ("error" in result)
                            failures.push(result.error);
                        else {
                            const applied = applyTranslation(editor, block, result.mdx, null);
                            if (applied === "changed")
                                skipped += 1;
                            else if (applied === "invalid")
                                failures.push(t("toast.invalidMany"));
                        }
                    }
                }
                catch (error) {
                    if (controller.signal.aborted)
                        return;
                    fatal = errorText(error, t("runFailed"));
                }
                setProgress((current) => (current ? { ...current, done: current.done + group.length } : current));
            }
        };
        await Promise.all(Array.from({ length: Math.min(PARALLEL_REQUESTS, groups.length) }, worker));
        setProgress(null);
        abortRef.current = null;
        if (controller.signal.aborted)
            toast.message(t("toast.stoppedKeep"));
        else if (fatal)
            toast.error(fatal);
        else if (failures.length > 0 || skipped > 0) {
            toast.warning(`${t("toast.partial", { done: blocks.length - failures.length - skipped, kept: failures.length + skipped })}${failures[0] ? ` · ${failures[0]}` : ""}`);
        }
        else
            toast.success(t("toast.all", { count: blocks.length }));
    }, [locales, request, actionKey]);
    const blockActions = useMemo(() => features.map((item) => ({
        id: `ai-translate:${item.key}`,
        label: item.label,
        icon: _jsx(Languages, { "aria-hidden": true, className: "size-3.5" }),
        isAvailable: (editor, pos) => unitAt(editor.state.doc, pos) !== null && progress === null,
        isBusy: (pos) => busyBlocks.has(pos),
        run: (editor, pos) => void translateOne(editor, pos, item.key),
    })), [features, busyBlocks, progress, translateOne]);
    const running = progress !== null || busyBlocks.size > 0;
    const toolbar = feature ? (running ? (_jsxs("span", { className: "flex items-center gap-1", children: [progress && (_jsx("span", { className: "text-cms-muted-foreground text-xs tabular-nums", children: t("progress", { done: progress.done, total: progress.total }) })), _jsxs(Button, { type: "button", size: "sm", variant: "ghost", className: "gap-1.5 text-cms-muted-foreground", onClick: stop, children: [_jsx(Square, { "aria-hidden": true, className: "size-4" }), t("stop")] })] })) : (_jsxs(Popover, { open: open, onOpenChange: setOpen, children: [_jsxs(PopoverTrigger, { render: _jsx(Button, { type: "button", size: "sm", variant: "ghost", className: "gap-1.5 text-cms-muted-foreground" }), children: [_jsx(Languages, { "aria-hidden": true, className: "size-4" }), t("all")] }), _jsx(PopoverContent, { align: "end", className: "w-72 gap-2 p-3 text-xs", children: _jsxs("form", { className: "flex flex-col gap-2", onSubmit: (event) => {
                        event.preventDefault();
                        void translateAll();
                    }, children: [features.length > 1 && (_jsx(OptionSelect, { "aria-label": t("action"), value: feature.key, options: features.map((item) => ({ value: item.key, label: item.label })), onChange: setChosenKey })), feature.askInstruction && (_jsx(Textarea, { "aria-label": t("request"), placeholder: t("request"), rows: 3, value: request, onChange: (event) => setRequest(event.target.value), onKeyDown: (event) => {
                                // Enter inserts a newline; Cmd/Ctrl+Enter runs.
                                if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    void translateAll();
                                }
                            }, className: "min-h-16 resize-y text-xs md:text-xs" })), _jsxs(Button, { type: "submit", size: "sm", className: "self-end", children: [_jsx(Languages, { "aria-hidden": true }), t("run")] })] }) })] }))) : null;
    return { blockActions, toolbar, setEditor };
}
/** AI translation attached as an edit-screen extension. Adds Translate all to the translation editor's toolbar and translation actions next to block handles. */
export const useAiTranslateExtension = ({ translateLocales }) => {
    const translate = useAiTranslate(translateLocales);
    return {
        toolbar: translate.toolbar,
        blockActions: translate.blockActions.length > 0 ? translate.blockActions : undefined,
        onEditor: translate.setEditor,
    };
};
