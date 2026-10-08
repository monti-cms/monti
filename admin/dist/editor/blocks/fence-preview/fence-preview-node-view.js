"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../../lib/utils/cn.js";
import { SELECTED_RING } from "../block-model.js";
import { blocksMessages } from "../messages.js";
import { BlockFrame, useBlockEditor } from "../use-block-editor.js";
const PROSEMIRROR_CURSOR_KEYS = new Set([
    "Enter",
    "Tab",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Backspace",
    "Delete",
    "Home",
    "End",
    "PageUp",
    "PageDown",
]);
/**
 * Edit view of a block written as code (`useBlockEditor().source`), showing the code input field and the preview together. Selecting or clicking opens the input field; otherwise only the preview shows.
 * Input is written to the document after a short pause or when leaving the field (not during Korean composition).
 */
export function FencePreviewBlockView({ meta }) {
    const t = useTranslator(blocksMessages);
    const block = useBlockEditor();
    const { kind } = meta;
    const value = block.source ?? "";
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [previewValue, setPreviewValue] = useState(value);
    const lastCommittedRef = useRef(value);
    const inputId = useId();
    const isComposingRef = useRef(false);
    const debounceTimerRef = useRef(null);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const containerRef = useRef(null);
    const textareaRef = useRef(null);
    const isEditable = block.editable;
    const setSourceRef = useRef(block.setSource);
    setSourceRef.current = block.setSource;
    const commitValue = (val) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        setPreviewValue(val);
        if (val !== lastCommittedRef.current) {
            lastCommittedRef.current = val;
            block.setSource(val);
        }
    };
    useEffect(() => {
        if (!isComposingRef.current && value !== lastCommittedRef.current) {
            // An outside transaction (e.g. undo) changed the value. Cancel the pending input commit so it does not overwrite the new value.
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            lastCommittedRef.current = value;
            setDraft(value);
            setPreviewValue(value);
        }
    }, [value]);
    useEffect(() => {
        return () => {
            if (!debounceTimerRef.current && !isComposingRef.current)
                return;
            if (debounceTimerRef.current)
                clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
            // Write input not yet committed to the document before disappearing. If the node is already deleted, there is nowhere to write.
            if (draftRef.current === lastCommittedRef.current)
                return;
            // Fails quietly when the node already left the document.
            setSourceRef.current(draftRef.current);
        };
    }, []);
    const isOpen = (block.selected || isEditing) && isEditable;
    const handleClick = () => {
        if (!isEditable)
            return;
        setIsEditing(true);
        // Move focus to the textarea when the node view is clicked
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
        });
    };
    const handleBlur = (e) => {
        if (containerRef.current?.contains(e.relatedTarget)) {
            return;
        }
        // Commit pending changes immediately on blur
        commitValue(draftRef.current);
        setIsEditing(false);
    };
    const handleTextChange = (e) => {
        const val = e.target.value;
        setDraft(val);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        // During composition, compositionend commits the final value.
        if (isComposingRef.current || e.nativeEvent.isComposing)
            return;
        // Commit and refresh the preview after a debounce of about 400ms
        debounceTimerRef.current = setTimeout(() => {
            if (isComposingRef.current)
                return;
            commitValue(val);
        }, 400);
    };
    const handleCompositionStart = () => {
        isComposingRef.current = true;
    };
    const handleCompositionEnd = (e) => {
        isComposingRef.current = false;
        const val = e.currentTarget.value;
        setDraft(val);
        // Commit immediately when IME composition ends
        commitValue(val);
    };
    const handleKeyDown = (e) => {
        if (e.metaKey || e.ctrlKey) {
            // The save shortcut is handled outside (the edit view). Write pending input to the document before that.
            if (e.key.toLowerCase() === "s") {
                commitValue(draftRef.current);
                return;
            }
            // Other combinations (select all, undo, Mac cursor movement) work only inside the input field.
            e.stopPropagation();
            return;
        }
        if (PROSEMIRROR_CURSOR_KEYS.has(e.key)) {
            // Stop propagation only for ProseMirror cursor keys, to keep the textarea's own behavior
            e.stopPropagation();
        }
    };
    const renderPreview = () => meta.preview(previewValue);
    return (_jsx(BlockFrame, { ref: containerRef, framed: false, selectedRing: false, "data-fence-preview": kind, onBlur: handleBlur, className: cn("group relative my-4 rounded-md border border-cms-border bg-cms-card p-3 shadow-xs transition-colors", isOpen && SELECTED_RING), children: isOpen ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between border-cms-border/40 border-b pb-1 text-cms-muted-foreground text-xs", children: [_jsx("span", { className: "font-medium font-mono text-[11px]", children: meta.label }), _jsx("span", { className: "text-[10px] text-cms-muted-foreground/70", children: isEditing ? t("fence.editing") : t("fence.selected") })] }), _jsx("div", { className: "min-h-[40px] rounded-md border border-cms-border/40 bg-cms-background/50 p-2", children: renderPreview() }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { htmlFor: inputId, className: "font-mono text-[11px] text-cms-muted-foreground", children: t("fence.sourceCode") }), _jsx("textarea", { id: inputId, ref: textareaRef, value: draft, placeholder: meta.placeholder, spellCheck: false, autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", onChange: handleTextChange, onCompositionStart: handleCompositionStart, onCompositionEnd: handleCompositionEnd, onKeyDown: handleKeyDown, className: "field-sizing-content min-h-[96px] w-full resize-y rounded-md border border-cms-input bg-transparent px-2.5 py-2 font-mono text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-cms-muted-foreground/50 focus-visible:border-cms-ring focus-visible:ring-3 focus-visible:ring-cms-ring/50 md:text-sm" })] })] })) : (_jsx("button", { type: "button", onClick: handleClick, className: "w-full cursor-pointer border-0 bg-transparent p-0 text-left font-inherit outline-none", "aria-label": t("fence.edit", { label: meta.label }), children: draft.trim() ? (renderPreview()) : (_jsx("div", { className: "rounded border border-cms-border/80 border-dashed p-4 text-center text-cms-muted-foreground text-xs hover:border-cms-foreground/30", children: t("fence.enter", { label: meta.label }) })) })) }));
}
