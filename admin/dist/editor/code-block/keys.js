import { Plugin, TextSelection } from "@tiptap/pm/state";
export function isComposing(view, event) {
    if (view.composing)
        return true;
    if ("isComposing" in event && event.isComposing)
        return true;
    if ("keyCode" in event && event.keyCode === 229)
        return true;
    return false;
}
export function findCodeBlockDepth(state) {
    const { $from } = state.selection;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "codeBlock")
            return d;
    }
    return null;
}
export function isInCodeBlock(state) {
    return findCodeBlockDepth(state) !== null;
}
export function handleTabKey(view, event, isShift) {
    if (isComposing(view, event))
        return false;
    const depth = findCodeBlockDepth(view.state);
    if (depth === null)
        return false;
    event.preventDefault();
    const state = view.state;
    const { $from, $to } = state.selection;
    const blockStart = $from.start(depth);
    const blockEnd = $from.end(depth);
    const text = state.doc.textBetween(blockStart, blockEnd, "\n", "\0");
    const selFrom = $from.pos - blockStart;
    const selTo = $to.pos - blockStart;
    // Compute the [start, end] offsets of each line (relative to blockStart)
    const lines = [];
    let offset = 0;
    for (const line of text.split("\n")) {
        const start = offset;
        const end = start + line.length;
        lines.push({ start, end, text: line });
        offset = end + 1; // '\n'
    }
    // Find the line indexes the selection spans
    const selectedLineIndices = [];
    lines.forEach((line, index) => {
        const lineStart = line.start;
        const lineEnd = line.end;
        if (selFrom === selTo) {
            if (selFrom >= lineStart && (selFrom <= lineEnd || index === lines.length - 1)) {
                selectedLineIndices.push(index);
            }
        }
        else {
            // When it is a range selection
            if (lineEnd >= selFrom && lineStart <= selTo) {
                if (selTo === lineStart && selTo > selFrom) {
                    // Exclude when the cursor sits exactly at a line start
                    return;
                }
                selectedLineIndices.push(index);
            }
        }
    });
    if (selectedLineIndices.length === 0)
        return false;
    if (!isShift) {
        // Tab: indent
        if (selFrom === selTo && selectedLineIndices.length === 1) {
            // Insert a tab character at a plain cursor position
            view.dispatch(state.tr.insertText("\t").scrollIntoView());
            return true;
        }
        // Indent multiple selected lines
        let tr = state.tr;
        for (let i = selectedLineIndices.length - 1; i >= 0; i--) {
            const lineIdx = selectedLineIndices[i];
            const line = lines[lineIdx];
            if (!line)
                continue;
            const pos = blockStart + line.start;
            tr = tr.insertText("\t", pos);
        }
        // Update selection: reflect first-line indentation
        const firstLine = lines[selectedLineIndices[0]];
        const lastLine = lines[selectedLineIndices[selectedLineIndices.length - 1]];
        if (firstLine && lastLine) {
            const newFrom = blockStart + firstLine.start;
            const addedCount = selectedLineIndices.length;
            const newTo = Math.min(tr.doc.content.size, blockStart + lastLine.end + addedCount);
            tr = tr.setSelection(TextSelection.create(tr.doc, newFrom, newTo));
        }
        view.dispatch(tr.scrollIntoView());
        return true;
    }
    // Shift-Tab: outdent
    let tr = state.tr;
    let changed = false;
    for (let i = selectedLineIndices.length - 1; i >= 0; i--) {
        const lineIdx = selectedLineIndices[i];
        const line = lines[lineIdx];
        if (!line)
            continue;
        let deleteCount = 0;
        if (line.text.startsWith("\t")) {
            deleteCount = 1;
        }
        else if (line.text.startsWith("  ")) {
            deleteCount = 2;
        }
        else if (line.text.startsWith(" ")) {
            deleteCount = 1;
        }
        if (deleteCount > 0) {
            changed = true;
            const pos = blockStart + line.start;
            tr = tr.delete(pos, pos + deleteCount);
        }
    }
    if (!changed)
        return true;
    view.dispatch(tr.scrollIntoView());
    return true;
}
export function handleEnterKey(view, event) {
    if (isComposing(view, event))
        return false;
    const depth = findCodeBlockDepth(view.state);
    if (depth === null)
        return false;
    event.preventDefault();
    const state = view.state;
    const { $from } = state.selection;
    const blockStart = $from.start(depth);
    const textBeforeInBlock = state.doc.textBetween(blockStart, $from.pos, "\n", "\0");
    // Find the start of the current line
    const lastNewline = textBeforeInBlock.lastIndexOf("\n");
    const currentLineBeforeCursor = lastNewline === -1 ? textBeforeInBlock : textBeforeInBlock.slice(lastNewline + 1);
    // Extract the leading whitespace (indentation) of the current line
    const indentMatch = currentLineBeforeCursor.match(/^[\t ]*/);
    const indent = indentMatch ? indentMatch[0] : "";
    const tr = state.tr.replaceSelectionWith(state.schema.text(`\n${indent}`)).scrollIntoView();
    view.dispatch(tr);
    return true;
}
export function handleModAKey(view, event) {
    if (isComposing(view, event))
        return false;
    const depth = findCodeBlockDepth(view.state);
    if (depth === null)
        return false;
    event.preventDefault();
    const state = view.state;
    const { $from } = state.selection;
    const start = $from.start(depth);
    const end = $from.end(depth);
    const tr = state.tr.setSelection(TextSelection.create(state.doc, start, end)).scrollIntoView();
    view.dispatch(tr);
    return true;
}
export function handlePaste(view, event) {
    if (!isInCodeBlock(view.state))
        return false;
    const clipboard = event.clipboardData;
    if (!clipboard)
        return false;
    const text = clipboard.getData("text/plain");
    if (!text)
        return false;
    event.preventDefault();
    // Normalize \r\n → \n and \r → \n
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const tr = view.state.tr.replaceSelectionWith(view.state.schema.text(normalized)).scrollIntoView();
    view.dispatch(tr);
    return true;
}
export function createCodeBlockKeysPlugin() {
    return new Plugin({
        props: {
            handleKeyDown(view, event) {
                if (isComposing(view, event))
                    return false;
                if (!isInCodeBlock(view.state))
                    return false;
                if (event.key === "Tab") {
                    return handleTabKey(view, event, event.shiftKey);
                }
                if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
                    return handleEnterKey(view, event);
                }
                if (event.key.toLowerCase() === "a" && (event.metaKey || event.ctrlKey)) {
                    return handleModAKey(view, event);
                }
                return false;
            },
            handlePaste(view, event) {
                return handlePaste(view, event);
            },
        },
    });
}
