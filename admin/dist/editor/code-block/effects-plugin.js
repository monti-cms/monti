import { ANCHOR, COLLAPSE, charEffectByName, lineAt, lineRange, lineStarts, ruleMatches, } from "@monti-cms/core/code-block";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { codeAnchorRef } from "../added-marks.js";
import { codeBlockMessages } from "./messages.js";
/** Transaction meta that changes the plugin state (used by the link commands). */
export const effectsMeta = (meta) => meta;
export const codeEffectsKey = new PluginKey("cmsCodeEffects");
export const lineEffectsOf = (node) => Array.isArray(node.attrs.lineEffects) ? node.attrs.lineEffects : [];
export const rulesOf = (node) => Array.isArray(node.attrs.rules) ? node.attrs.rules : [];
/** Range that a text fold mark spans (in code text). */
function foldMarkRanges(node) {
    const ranges = [];
    node.forEach((child, offset) => {
        const mark = child.marks.find((item) => item.type.name === "codeFold");
        if (!mark)
            return;
        const last = ranges[ranges.length - 1];
        const open = mark.attrs.open === true;
        if (last && last.to === offset && last.open === open)
            last.to = offset + child.nodeSize;
        else
            ranges.push({ from: offset, to: offset + child.nodeSize, open });
    });
    return ranges;
}
/** Fold ranges of the code block (document position `pos`). */
export function foldRegions(node, pos, overrides) {
    if (node.attrs.rawMode)
        return [];
    const base = pos + 1;
    const text = node.textContent;
    const starts = lineStarts(text);
    const regions = [];
    // A text fold mark and a rule that fold the same place count as one (same key).
    const push = (region) => {
        if (regions.some((other) => other.key === region.key))
            return;
        regions.push({ ...region, open: overrides.get(region.key) ?? region.defaultOpen });
    };
    for (const effect of lineEffectsOf(node)) {
        if (effect.name !== COLLAPSE || effect.end - effect.start < 2 || effect.end > starts.length)
            continue;
        push({
            key: `c:${effect.id}`,
            kind: "collapse",
            from: base + lineRange(text, starts, effect.start).to,
            to: base + lineRange(text, starts, effect.end - 1).to,
            defaultOpen: effect.attrs.open === true,
            hiddenLines: effect.end - effect.start - 1,
            startLine: effect.start,
            endLine: effect.end,
        });
    }
    for (const range of foldMarkRanges(node))
        push({
            key: `m:${base + range.from}`,
            kind: "fold",
            from: base + range.from,
            to: base + range.to,
            // In the editor, text folds are kept open so the text can be edited. `open` is the initial state on the public page.
            defaultOpen: true,
            hiddenLines: 0,
        });
    for (const rule of rulesOf(node)) {
        if (rule.name !== "fold")
            continue;
        for (const match of ruleMatches(rule, text, starts))
            push({
                key: `m:${base + match.from}`,
                kind: "fold",
                from: base + match.from,
                to: base + match.to,
                defaultOpen: true,
                hiddenLines: 0,
            });
    }
    return regions;
}
/** Ranges that are shown folded (not inside another folded range). */
export function visibleClosedRegions(regions) {
    const closed = regions.filter((region) => !region.open && region.to > region.from);
    return closed.filter((region) => !closed.some((other) => other !== region &&
        other.from <= region.from &&
        region.to <= other.to &&
        other.to - other.from > region.to - region.from));
}
/** Whether the cursor is inside folded, hidden text. For a line fold, the end of the last hidden line also counts as inside. */
const hidesPosition = (region, head) => region.kind === "collapse" ? region.from < head && head <= region.to : region.from < head && head < region.to;
/**
 * Marks lines `start` to `end` of the code block (`blockPos`) as picked in the line number gutter.
 * Text is not selected (it is not painted like a drag selection). Only the cursor is placed before the first line; the picked lines are shown by the line background.
 */
export function pickLines(view, blockPos, start, end) {
    const node = view.state.doc.nodeAt(blockPos);
    if (!node || node.type.name !== "codeBlock")
        return;
    const text = node.textContent;
    const from = blockPos + 1 + lineRange(text, lineStarts(text), start).from;
    view.dispatch(view.state.tr
        .setSelection(TextSelection.create(view.state.doc, from))
        .setMeta(codeEffectsKey, { pick: { blockPos, start, end } }));
    view.focus();
}
/** Removes a rule (its effect disappears everywhere it matched). */
export function removeRule(view, blockPos, ruleId) {
    const node = view.state.doc.nodeAt(blockPos);
    if (!node || node.type.name !== "codeBlock")
        return;
    const rules = rulesOf(node).filter((rule) => rule.id !== ruleId);
    view.dispatch(view.state.tr.setNodeMarkup(blockPos, undefined, { ...node.attrs, rules }));
}
/** Removes a rule and leaves the same effect as a text mark at every place it currently matches (so each can be removed one by one). */
export function expandRule(view, blockPos, ruleId) {
    const node = view.state.doc.nodeAt(blockPos);
    const rule = node ? rulesOf(node).find((item) => item.id === ruleId) : undefined;
    const markName = rule ? charEffectByName(rule.name)?.mark : undefined;
    const type = markName ? view.state.schema.marks[markName] : undefined;
    if (!node || !rule || !type)
        return;
    const attrs = rule.name === "Tooltip"
        ? { content: String(rule.attrs.content ?? "") }
        : rule.name === "fold"
            ? { open: rule.attrs.open === true }
            : null;
    const tr = view.state.tr;
    for (const match of ruleMatches(rule, node.textContent))
        tr.addMark(blockPos + 1 + match.from, blockPos + 1 + match.to, type.create(attrs));
    tr.setNodeMarkup(blockPos, undefined, { ...node.attrs, rules: rulesOf(node).filter((item) => item.id !== ruleId) });
    view.dispatch(tr);
}
/** Toggles a fold. When folding, if the cursor would be hidden, it moves to before the fold. */
export function setFoldOpen(view, region, open) {
    const tr = view.state.tr.setMeta(codeEffectsKey, { key: region.key, open });
    if (!open && hidesPosition(region, view.state.selection.head))
        tr.setSelection(TextSelection.create(tr.doc, region.from));
    view.dispatch(tr);
}
/** Style of text matched by a rule. A faint background shows it came from a rule (the text cannot be clicked to edit). */
const RULE_CLASS = {
    strong: "font-bold",
    em: "italic",
    del: "line-through",
    u: "underline underline-offset-4",
    Tooltip: "underline decoration-dotted underline-offset-4",
    fold: "rounded-sm outline-1 outline-cms-muted-foreground/50 outline-dashed -outline-offset-1",
};
function foldWidget(t, region) {
    return Decoration.widget(region.from, (view) => {
        const button = document.createElement("button");
        button.type = "button";
        button.contentEditable = "false";
        button.dataset.codeFoldToggle = region.kind;
        button.className =
            "mx-0.5 inline-flex h-5 items-center rounded bg-cms-muted px-1 align-middle font-sans text-cms-muted-foreground text-xs leading-none hover:bg-cms-accent hover:text-cms-foreground";
        button.textContent = region.kind === "collapse" ? `⋯ ${t("fold.lines", { count: region.hiddenLines })}` : "…";
        button.title =
            region.kind === "collapse" ? t("fold.expandLines", { count: region.hiddenLines }) : t("fold.expandText");
        button.setAttribute("aria-label", button.title);
        button.addEventListener("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            setFoldOpen(view, region, true);
        });
        return button;
    }, { side: 1, key: `fold:${region.key}:${region.hiddenLines}`, ignoreSelection: true, stopEvent: () => true });
}
function blockDecorations(t, node, pos, overrides) {
    if (node.attrs.rawMode)
        return [];
    const base = pos + 1;
    const text = node.textContent;
    const starts = lineStarts(text);
    const decorations = [];
    for (const rule of rulesOf(node)) {
        const style = RULE_CLASS[rule.name];
        if (!style)
            continue;
        const label = charEffectByName(rule.name)?.label ?? rule.name;
        const title = rule.name === "Tooltip"
            ? String(rule.attrs.content ?? "")
            : t("rule.title", { label, pattern: rule.pattern, flags: rule.flags });
        for (const match of ruleMatches(rule, text, starts))
            decorations.push(Decoration.inline(base + match.from, base + match.to, {
                class: `${style} bg-sky-500/10`,
                title,
                "data-code-rule": rule.id,
            }));
    }
    for (const region of visibleClosedRegions(foldRegions(node, pos, overrides))) {
        decorations.push(Decoration.inline(region.from, region.to, { class: "hidden" }));
        decorations.push(foldWidget(t, region));
    }
    return decorations;
}
/** Line labels of every code line in the document (ids of `anchor` line effects). */
export function anchorIds(doc) {
    const ids = new Set();
    doc.descendants((node) => {
        if (node.type.name !== "codeBlock")
            return true;
        for (const effect of lineEffectsOf(node))
            if (effect.name === ANCHOR && typeof effect.attrs.id === "string")
                ids.add(effect.attrs.id);
        return false;
    });
    return ids;
}
/** If the line of the body link under the mouse is in this code block, dims the other lines. */
function hoverDecorations(node, pos, id) {
    const anchor = lineEffectsOf(node).find((effect) => effect.name === ANCHOR && effect.attrs.id === id);
    if (!anchor)
        return [];
    const text = node.textContent;
    const starts = lineStarts(text);
    const decorations = [];
    for (let line = 0; line < starts.length; line += 1) {
        if (anchor.start <= line && line < anchor.end)
            continue;
        const range = lineRange(text, starts, line);
        if (range.to > range.from)
            decorations.push(Decoration.inline(pos + 1 + range.from, pos + 1 + range.to, { class: "opacity-35" }));
    }
    return decorations;
}
/** Moves old line numbers to new ones following text changes. */
function remapLineEffects(oldNode, oldPos, newNode, newPos, mapping) {
    const oldText = oldNode.textContent;
    const oldStarts = lineStarts(oldText);
    const newText = newNode.textContent;
    const newStarts = lineStarts(newText);
    const toNewLine = (oldOffset, assoc) => {
        const mapped = mapping.map(oldPos + 1 + oldOffset, assoc) - (newPos + 1);
        return lineAt(newStarts, Math.max(0, Math.min(newText.length, mapped)));
    };
    const lineEffects = lineEffectsOf(oldNode)
        .map((effect) => {
        if (effect.start >= oldStarts.length)
            return null;
        const first = lineRange(oldText, oldStarts, effect.start).from;
        const last = lineRange(oldText, oldStarts, Math.min(effect.end, oldStarts.length) - 1).to;
        // If all text of an effect line was deleted, the effect is deleted too (it is not moved onto the next line).
        const head = mapping.mapResult(oldPos + 1 + first, 1);
        const tail = mapping.mapResult(oldPos + 1 + last, -1);
        if (last > first && head.deletedAfter && tail.deletedBefore && head.pos >= tail.pos)
            return null;
        const start = toNewLine(first, 1);
        const end = toNewLine(last, -1) + 1;
        return end > start ? { ...effect, start, end } : null;
    })
        .filter((effect) => effect !== null);
    const rules = rulesOf(oldNode).map((rule) => rule.scope === "char" && rule.line !== undefined && rule.line < oldStarts.length
        ? { ...rule, line: toNewLine(lineRange(oldText, oldStarts, rule.line).from, 1) }
        : rule);
    return { lineEffects, rules };
}
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function createCodeEffectsPlugin(site) {
    const t = site.createTranslator(codeBlockMessages);
    const anchor = codeAnchorRef(site);
    return new Plugin({
        key: codeEffectsKey,
        state: {
            init: () => ({ overrides: new Map(), picked: null, linking: null, hoverRef: null, version: 0 }),
            apply(tr, value, _oldState, newState) {
                let overrides = value.overrides;
                let changed = false;
                if (tr.docChanged && [...overrides.keys()].some((key) => key.startsWith("m:"))) {
                    const next = new Map();
                    for (const [key, open] of overrides) {
                        if (!key.startsWith("m:")) {
                            next.set(key, open);
                            continue;
                        }
                        const mapped = tr.mapping.mapResult(Number(key.slice(2)), 1);
                        if (!mapped.deleted)
                            next.set(`m:${mapped.pos}`, open);
                    }
                    overrides = next;
                    changed = true;
                }
                const meta = tr.getMeta(codeEffectsKey);
                if (meta && "key" in meta) {
                    if (!changed)
                        overrides = new Map(overrides);
                    overrides.set(meta.key, meta.open);
                    changed = true;
                }
                // The line-number gutter reports picking lines together with the selection. Changing the selection by other means clears it.
                let picked = value.picked;
                if (meta && "pick" in meta)
                    picked = meta.pick;
                else if (picked && tr.selectionSet)
                    picked = null;
                else if (picked && tr.docChanged) {
                    // Map the position before the block with a forward bias. Changing the effect (setNodeMarkup) replaces the whole block, so the back side would become "deleted".
                    const mapped = tr.mapping.mapResult(picked.blockPos, -1);
                    picked = mapped.deleted ? null : { ...picked, blockPos: mapped.pos };
                }
                if (picked !== value.picked)
                    changed = true;
                let linking = value.linking;
                if (meta && "linking" in meta)
                    linking = meta.linking;
                else if (linking && tr.docChanged) {
                    if (linking.kind === "text") {
                        const from = tr.mapping.map(linking.from, 1);
                        const to = tr.mapping.map(linking.to, -1);
                        linking = to > from ? { ...linking, from, to } : null;
                    }
                    else {
                        const mapped = tr.mapping.mapResult(linking.blockPos, -1);
                        linking = mapped.deleted ? null : { ...linking, blockPos: mapped.pos };
                    }
                }
                if (linking !== value.linking)
                    changed = true;
                const hoverRef = meta && "hoverRef" in meta ? meta.hoverRef : value.hoverRef;
                if (hoverRef !== value.hoverRef)
                    changed = true;
                // Open the fold when the cursor enters a folded, hidden place (arrow keys, undo, etc.).
                const { $head, head } = newState.selection;
                for (let depth = $head.depth; depth > 0; depth -= 1) {
                    const node = $head.node(depth);
                    if (node.type.name !== "codeBlock")
                        continue;
                    for (const region of foldRegions(node, $head.before(depth), overrides)) {
                        if (region.open || !hidesPosition(region, head))
                            continue;
                        if (!changed)
                            overrides = new Map(overrides);
                        overrides.set(region.key, true);
                        changed = true;
                    }
                    break;
                }
                return changed ? { overrides, picked, linking, hoverRef, version: value.version + 1 } : value;
            },
        },
        props: {
            decorations(state) {
                const plugin = codeEffectsKey.getState(state);
                const overrides = plugin?.overrides ?? new Map();
                const decorations = [];
                const anchors = anchorIds(state.doc);
                state.doc.descendants((node, pos) => {
                    if (node.type.name === "codeBlock") {
                        decorations.push(...blockDecorations(t, node, pos, overrides));
                        if (plugin?.hoverRef)
                            decorations.push(...hoverDecorations(node, pos, plugin.hoverRef));
                        return false;
                    }
                    // A body link with no linked line is flagged with a red wavy underline.
                    const ref = node.isText && anchor ? node.marks.find((mark) => mark.type.name === anchor.mark) : undefined;
                    if (ref && anchor && !anchors.has(String(ref.attrs[anchor.attribute])))
                        decorations.push(Decoration.inline(pos, pos + node.nodeSize, {
                            class: "decoration-wavy decoration-red-500",
                            title: t("anchor.missing"),
                        }));
                    return true;
                });
                // While linking (body text picked first), paint the picked text.
                if (plugin?.linking?.kind === "text")
                    decorations.push(Decoration.inline(plugin.linking.from, plugin.linking.to, { class: "rounded-sm bg-cms-primary/15" }));
                return decorations.length ? DecorationSet.create(state.doc, decorations) : DecorationSet.empty;
            },
            handleKeyDown(view, event) {
                if (event.key !== "Escape" || !codeEffectsKey.getState(view.state)?.linking)
                    return false;
                view.dispatch(view.state.tr.setMeta(codeEffectsKey, effectsMeta({ linking: null })));
                return true;
            },
            handleDOMEvents: {
                // Hovering a body link highlights the linked code line (same as the public page).
                mouseover(view, event) {
                    const target = event.target instanceof Element ? event.target.closest("[data-code-ref]") : null;
                    const id = target?.getAttribute("data-code-ref") || null;
                    if (id !== (codeEffectsKey.getState(view.state)?.hoverRef ?? null))
                        view.dispatch(view.state.tr.setMeta(codeEffectsKey, effectsMeta({ hoverRef: id })));
                    return false;
                },
                mouseleave(view) {
                    if (codeEffectsKey.getState(view.state)?.hoverRef)
                        view.dispatch(view.state.tr.setMeta(codeEffectsKey, effectsMeta({ hoverRef: null })));
                    return false;
                },
            },
        },
        appendTransaction(transactions, oldState, newState) {
            if (!transactions.some((tr) => tr.docChanged))
                return null;
            const mapping = new Mapping();
            for (const tr of transactions)
                mapping.appendMapping(tr.mapping);
            let update = null;
            oldState.doc.descendants((oldNode, oldPos) => {
                if (oldNode.type.name !== "codeBlock")
                    return true;
                if (!lineEffectsOf(oldNode).length && !rulesOf(oldNode).some((rule) => rule.scope === "char"))
                    return false;
                const mapped = mapping.mapResult(oldPos, 1);
                if (mapped.deleted)
                    return false;
                const newNode = newState.doc.nodeAt(mapped.pos);
                if (!newNode || newNode.type.name !== "codeBlock" || newNode.textContent === oldNode.textContent)
                    return false;
                // If attributes were newly set in the same transaction (block replacement, effect edit), those attributes are authoritative.
                if (!sameJson(newNode.attrs.lineEffects, oldNode.attrs.lineEffects) ||
                    !sameJson(newNode.attrs.rules, oldNode.attrs.rules))
                    return false;
                const next = remapLineEffects(oldNode, oldPos, newNode, mapped.pos, mapping);
                if (sameJson(next.lineEffects, newNode.attrs.lineEffects) && sameJson(next.rules, newNode.attrs.rules))
                    return false;
                update ??= newState.tr;
                update.setNodeMarkup(mapped.pos, undefined, { ...newNode.attrs, ...next });
                return false;
            });
            return update;
        },
    });
}
