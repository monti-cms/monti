"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { blockNodeName, MdxPreview, mdxToTiptap, tiptapToMdx } from "@monti-cms/admin/editor";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Tabs, TabsList, TabsTrigger, Textarea, } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { aiCommonMessages } from "./ai-common.messages.js";
import { streamAiAction, useAiActions } from "./ai-slot-provider.js";
import { aiWriteMessages } from "./ai-write.messages.js";
import { diffWords } from "./word-diff.js";
const t = createTranslator(aiWriteMessages);
const common = createTranslator(aiCommonMessages);
/** MDX of the selection. A paragraph with only part selected contains only that part. */
function selectionMdx(editor, from, to) {
    const slice = editor.state.doc.slice(from, to);
    const nodes = (slice.content.toJSON() ?? []);
    // Selecting inside one paragraph yields only a text fragment. It has to be wrapped in a paragraph to be MDX.
    const content = slice.content.firstChild?.isInline ? [{ type: "paragraph", content: nodes }] : nodes;
    return tiptapToMdx({ type: "doc", content }).trim();
}
/** Result MDX as editor content. If the edit was inside one paragraph and the result is one paragraph, inserts only the text (the paragraph is not split). */
function contentFor(editor, from, to, mdx) {
    const blocks = mdxToTiptap(mdx).content ?? [];
    const $from = editor.state.doc.resolve(from);
    const $to = editor.state.doc.resolve(to);
    const inline = $from.parent === $to.parent && $from.parent.isTextblock;
    const only = blocks.length === 1 ? blocks[0] : undefined;
    return inline && only?.type === "paragraph" ? (only.content ?? []) : blocks;
}
function WriteDialog({ job, getEntry, onClose }) {
    const [request, setRequest] = useState("");
    const [state, setState] = useState({ status: "idle" });
    const controllerRef = useRef(null);
    const { action, editor } = job;
    const run = async () => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        setState({ status: "running", text: "" });
        const entry = getEntry?.();
        const input = job.mode === "selection"
            ? { selection: job.source, title: entry?.title || undefined }
            : job.mode === "block"
                ? { block: job.source, title: entry?.title || undefined }
                : { title: entry?.title || undefined, body: tiptapToMdx(editor.getJSON()).trim() || undefined };
        try {
            const result = await streamAiAction(action.key, Object.fromEntries(Object.entries(input).filter(([name, value]) => value && action.input[name])), {
                env: {
                    ...(entry?.collection ? { collection: entry.collection } : {}),
                    ...(entry?.locale ? { locale: entry.locale } : {}),
                    ...(entry?.entryId ? { entryId: entry.entryId } : {}),
                },
                request,
                signal: controller.signal,
                onText: (text) => setState({ status: "running", text }),
            });
            if (controller.signal.aborted)
                return;
            setState({ status: "done", text: "text" in result ? result.text : "" });
        }
        catch (error) {
            if (controller.signal.aborted)
                return;
            setState((current) => ({
                status: "error",
                text: "text" in current ? current.text : "",
                message: error instanceof Error && error.message ? error.message : common("runFailed"),
            }));
        }
    };
    // A draft (insert) has no text to fix, so it always asks for a request. An action with ask-for-request on also asks first.
    const askRequest = job.mode === "insert" || action.askInstruction;
    // Polish and block fix, where the text to fix is set, run as soon as they open. A block action with ask-for-request on asks for a request first.
    const fixed = job.mode === "selection" || (job.mode === "block" && !action.askInstruction);
    // biome-ignore lint/correctness/useExhaustiveDependencies: runs only once when opened
    useEffect(() => {
        if (fixed)
            void run();
        return () => controllerRef.current?.abort();
    }, []);
    // A block fix replaces only when the result is one block of the same kind.
    const blockProblem = useMemo(() => {
        if (job.mode !== "block" || state.status !== "done")
            return null;
        const blocks = mdxToTiptap(state.text).content ?? [];
        return blocks.length === 1 && blocks[0]?.type === job.nodeType ? null : t("blockMismatch");
    }, [job, state]);
    const apply = () => {
        if (state.status !== "done" || !state.text || blockProblem)
            return;
        // A block is replaced entirely with the result block.
        const content = job.mode === "block" ? (mdxToTiptap(state.text).content ?? []) : contentFor(editor, job.from, job.to, state.text);
        editor.chain().focus().insertContentAt({ from: job.from, to: job.to }, content).run();
        onClose();
    };
    const diff = useMemo(() => (job.mode !== "insert" && state.status === "done" ? diffWords(job.source, state.text) : null), [job, state]);
    const running = state.status === "running";
    const result = "text" in state ? state.text : "";
    // Even on failure, any text received is shown.
    const showResult = running || state.status === "done" || (state.status === "error" && !!state.text);
    // Fixed text (polish) is viewed from the changes; block and draft from the rendered shape.
    const [view, setView] = useState(job.mode === "selection" ? "source" : "preview");
    return (_jsx(Dialog, { open: true, onOpenChange: (open) => !open && onClose(), children: _jsxs(DialogContent, { className: "gap-4 sm:max-w-3xl", children: [_jsx(DialogHeader, { children: _jsxs(DialogTitle, { className: "flex items-center gap-2", children: [_jsx(Sparkles, { "aria-hidden": true, className: "size-4" }), action.label] }) }), askRequest && (_jsxs("form", { className: "space-y-2", onSubmit: (event) => {
                        event.preventDefault();
                        if (!running)
                            void run();
                    }, children: [_jsx(Textarea, { "aria-label": t("request"), value: request, rows: 3, onChange: (event) => setRequest(event.target.value), onKeyDown: (event) => {
                                // Enter inserts a newline; Cmd/Ctrl+Enter runs.
                                if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    if (!running)
                                        void run();
                                }
                            }, placeholder: job.mode === "insert" ? t("askWrite") : job.mode === "block" ? t("askChange") : t("request"), className: "max-h-48 min-h-20 resize-y text-sm", autoFocus: !fixed }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "submit", size: "sm", disabled: running, children: [state.status === "idle" ? _jsx(Sparkles, { "aria-hidden": true }) : _jsx(RefreshCw, { "aria-hidden": true }), running ? t("running") : state.status === "idle" ? t("run") : t("runAgain")] }) })] })), showResult && (_jsxs(Tabs, { value: view, onValueChange: (value) => setView(value), className: "min-w-0 gap-2", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "preview", children: t("preview") }), _jsx(TabsTrigger, { value: "source", children: job.mode === "insert" ? t("sourceInsert") : t("sourceChanges") })] }), _jsx("output", { "aria-live": "polite", className: "block min-w-0", children: view === "preview" ? (_jsx(ResultPreview, { job: job, text: result, done: state.status === "done" })) : (_jsx("pre", { className: "max-h-[50vh] min-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-cms-muted/40 p-3 font-mono text-xs leading-relaxed", children: diff ? _jsx(DiffText, { parts: diff }) : result || t("running") })) })] })), (state.status === "error" || blockProblem) && (_jsx("p", { role: "alert", className: "text-cms-destructive text-xs", children: state.status === "error" ? state.message : blockProblem })), _jsxs(DialogFooter, { children: [!askRequest && (_jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "sm:mr-auto", disabled: running, onClick: () => void run(), children: [_jsx(RefreshCw, { "aria-hidden": true }), running ? t("running") : t("runAgain")] })), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: onClose, children: t("cancel") }), _jsx(Button, { type: "button", size: "sm", disabled: state.status !== "done" || !state.text || !!blockProblem, onClick: apply, children: job.mode === "insert" ? t("insert") : t("replace") })] })] }) }));
}
/** Text with the changes (removed and added) marked. */
function DiffText({ parts }) {
    return parts.map((part, index) => part.type === "same" ? (_jsx("span", { children: part.text }, index)) : part.type === "del" ? (_jsx("del", { className: "bg-cms-destructive/15 text-cms-destructive line-through", children: part.text }, index)) : (_jsx("ins", { className: "bg-emerald-500/15 cms-dark:text-emerald-400 text-emerald-700 no-underline", children: part.text }, index)));
}
const PANEL = "max-h-[50vh] min-h-48 overflow-y-auto rounded-md bg-cms-muted/40 p-3";
/**
 * Renders the result in its text shape (diagrams and charts as pictures). While writing, half-written code does not render, so the source is shown.
 * Block fix shows the current block and the changed one side by side.
 */
function ResultPreview({ job, text, done }) {
    const after = done ? (_jsx(MdxPreview, { mdx: text, label: t("after") })) : (_jsx("pre", { className: "whitespace-pre-wrap font-mono text-cms-muted-foreground text-xs", children: text || t("running") }));
    if (job.mode === "insert")
        return _jsx("div", { className: PANEL, children: after });
    return (_jsxs("div", { className: "grid min-w-0 gap-3 sm:grid-cols-2", children: [_jsxs("section", { className: "min-w-0 space-y-1.5", children: [_jsx("h3", { className: "font-medium text-cms-muted-foreground text-xs", children: t("now") }), _jsx("div", { className: PANEL, children: _jsx(MdxPreview, { mdx: job.source, label: t("now") }) })] }), _jsxs("section", { className: "min-w-0 space-y-1.5", children: [_jsx("h3", { className: "font-medium text-cms-muted-foreground text-xs", children: t("after") }), _jsx("div", { className: PANEL, children: after })] })] }));
}
/** Whether the editor is an empty document. Re-checked on every change. */
function useIsEmpty(editor) {
    const [empty, setEmpty] = useState(false);
    useEffect(() => {
        if (!editor)
            return;
        const update = () => setEmpty(editor.isEmpty);
        update();
        editor.on("update", update);
        return () => {
            editor.off("update", update);
        };
    }, [editor]);
    return empty;
}
/** AI writing attached as an edit-screen extension (polish style, write a draft). */
export const useAiWriteExtension = ({ getEntry }) => {
    const { data } = useAiActions();
    const [editor, setEditor] = useState(null);
    const [job, setJob] = useState(null);
    const empty = useIsEmpty(editor);
    const usable = useMemo(() => {
        const ready = new Set(data?.usable ?? []);
        const actions = (data?.items ?? []).filter((action) => action.enabled && ready.has(action.key));
        return {
            selection: actions.filter((action) => action.attach.some((attach) => attach.slot === "selection")),
            insert: actions.filter((action) => action.attach.some((attach) => attach.slot === "insert")),
            block: actions.filter((action) => action.attach.some((attach) => attach.slot === "block")),
        };
    }, [data]);
    const selectionActions = useMemo(() => usable.selection.map((action) => ({
        id: `ai:${action.key}`,
        label: action.label,
        icon: _jsx(Sparkles, { "aria-hidden": true, className: "size-4" }),
        run: (current) => {
            const { from, to } = current.state.selection;
            if (from === to)
                return;
            setJob({ mode: "selection", action, editor: current, from, to, source: selectionMdx(current, from, to) });
        },
    })), [usable.selection]);
    const insertActions = useMemo(() => usable.insert.map((action) => ({
        id: `ai:${action.key}`,
        title: action.label,
        description: t("insertDescription"),
        keywords: ["ai", action.label],
        icon: "sparkles",
        run: (current, range) => setJob({ mode: "insert", action, editor: current, from: range.from, to: range.to }),
    })), [usable.insert]);
    const blockActions = useMemo(() => usable.block.map((action) => {
        // Editor node name of the block this action is attached to.
        const nodes = new Set(action.attach.flatMap((attach) => (attach.slot === "block" ? [blockNodeName({ name: attach.block })] : [])));
        return {
            id: `ai:${action.key}`,
            label: action.label,
            icon: _jsx(Sparkles, { "aria-hidden": true, className: "size-3.5" }),
            isAvailable: (current, pos) => nodes.has(current.state.doc.nodeAt(pos)?.type.name ?? ""),
            run: (current, pos) => {
                const node = current.state.doc.nodeAt(pos);
                if (!node)
                    return;
                const source = tiptapToMdx({ type: "doc", content: [node.toJSON()] }).trim();
                setJob({
                    mode: "block",
                    action,
                    editor: current,
                    from: pos,
                    to: pos + node.nodeSize,
                    source,
                    nodeType: node.type.name,
                });
            },
        };
    }), [usable.block]);
    const firstInsert = usable.insert[0];
    return {
        toolbar: (_jsx(_Fragment, { children: empty && editor && firstInsert && (_jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "gap-1.5 text-cms-muted-foreground", onClick: () => {
                    const { from, to } = editor.state.selection;
                    setJob({ mode: "insert", action: firstInsert, editor, from, to });
                }, children: [_jsx(Sparkles, { "aria-hidden": true, className: "size-4" }), firstInsert.label] })) })),
        overlay: job && _jsx(WriteDialog, { job: job, getEntry: getEntry, onClose: () => setJob(null) }),
        selectionActions,
        insertActions,
        blockActions,
        onEditor: setEditor,
    };
};
