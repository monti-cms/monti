import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect } from "react";
import { BLOCK_ID_ATTRIBUTE, SOURCE_BLOCK_ID_ATTRIBUTE } from "../../editor/block-ids.js";
/** Marker class of the paired blocks the sync anchors on, in both columns. */
export const ACTIVE_BLOCK_CLASS = "monti-source-active";
/**
 * How a column shows its marked block: only a faint background spread around it, with no bar (a shadow spread, so it does not shift layout and
 * also wraps list bullets).
 */
export const ACTIVE_BLOCK_STYLE = "[&_.monti-source-active]:rounded-sm [&_.monti-source-active]:bg-monti-primary/8 [&_.monti-source-active]:shadow-[0_0_0_12px_color-mix(in_oklab,var(--color-monti-primary)_8%,transparent)] [&_.monti-source-active]:transition-[background-color,box-shadow]";
/** Attribute the sync puts on the body of a source box whose paired translation box is collapsed. */
export const SOURCE_COLLAPSED_ATTRIBUTE = "data-source-collapsed";
/** Attribute a box view puts on its body while it is collapsed (the collapsible). */
const COLLAPSED_ATTRIBUTE = "data-monti-collapsed";
/** A box whose body is blocks, paired and anchored inside. Not a list or a table, which are anchored as a whole. */
const isFlowBox = (node) => node.isBlock &&
    !node.isTextblock &&
    !node.isAtom &&
    node.childCount > 0 &&
    !node.type.isInGroup("list") &&
    node.type.spec.tableRole === undefined &&
    Array.from({ length: node.childCount }, (_, index) => node.child(index)).every((child) => child.isBlock);
const stringAttr = (node, name) => {
    const value = node.attrs[name];
    return typeof value === "string" && value ? value : null;
};
/** The blocks of a document (`start` is the position its content starts at), with the blocks inside boxes whose body is blocks. */
export function syncBlocksOf(parent, start = 0) {
    const blocks = [];
    parent.forEach((node, offset) => {
        if (!node.isBlock)
            return;
        const pos = start + offset;
        blocks.push({
            id: stringAttr(node, BLOCK_ID_ATTRIBUTE),
            sourceId: stringAttr(node, SOURCE_BLOCK_ID_ATTRIBUTE),
            kind: node.type.name,
            pos,
            size: node.nodeSize,
            children: isFlowBox(node) ? syncBlocksOf(node, pos + 1) : null,
        });
    });
    return blocks;
}
const forEachSyncBlock = (blocks, visit) => {
    for (const block of blocks) {
        visit(block);
        if (block.children)
            forEachSyncBlock(block.children, visit);
    }
};
/** Pairs of the longest common subsequence of kinds, as index pairs. */
const kindPairs = (left, right) => {
    const n = left.length;
    const m = right.length;
    if (n === 0 || m === 0)
        return [];
    const width = m + 1;
    const rest = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            rest[i * width + j] =
                left[i]?.kind === right[j]?.kind
                    ? (rest[(i + 1) * width + j + 1] ?? 0) + 1
                    : Math.max(rest[(i + 1) * width + j] ?? 0, rest[i * width + j + 1] ?? 0);
        }
    }
    const pairs = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (left[i]?.kind === right[j]?.kind) {
            pairs.push([i, j]);
            i += 1;
            j += 1;
        }
        else if ((rest[(i + 1) * width + j] ?? 0) >= (rest[i * width + j + 1] ?? 0))
            i += 1;
        else
            j += 1;
    }
    return pairs;
};
/**
 * Pairs each translation block with at most one source block:
 * 1. by link, at any depth: a translation block whose `sourceId` is the id of a source block (the first block that claims it);
 * 2. the rest by kind, among the blocks of the same level of two paired boxes (or the two documents), and only between blocks that are
 *    paired in order, so a block added between two linked blocks (a split, a new paragraph) stays unpaired rather than taking a later one.
 */
export function pairSyncBlocks(translation, source) {
    const byId = new Map();
    forEachSyncBlock(source, (block) => {
        if (block.id !== null && !byId.has(block.id))
            byId.set(block.id, block);
    });
    const pairs = new Map();
    const used = new Set();
    forEachSyncBlock(translation, (block) => {
        const partner = block.sourceId === null ? undefined : byId.get(block.sourceId);
        if (!partner || used.has(partner))
            return;
        pairs.set(block, partner);
        used.add(partner);
    });
    const fill = (blocks, partners) => {
        // Blocks of this level already paired with a block of the partner level, in order: the stretches between them are paired by kind.
        const anchors = [[-1, -1]];
        blocks.forEach((block, i) => {
            const partner = pairs.get(block);
            const j = partner ? partners.indexOf(partner) : -1;
            if (j > (anchors.at(-1)?.[1] ?? -1))
                anchors.push([i, j]);
        });
        anchors.push([blocks.length, partners.length]);
        for (let a = 0; a + 1 < anchors.length; a += 1) {
            const [fromI, fromJ] = anchors[a];
            const [toI, toJ] = anchors[a + 1];
            const left = blocks.slice(fromI + 1, toI).filter((block) => !pairs.has(block));
            const right = partners.slice(fromJ + 1, toJ).filter((block) => !used.has(block));
            for (const [i, j] of kindPairs(left, right)) {
                pairs.set(left[i], right[j]);
                used.add(right[j]);
            }
        }
        for (const block of blocks) {
            const partner = pairs.get(block);
            if (block.children && partner?.children)
                fill(block.children, partner.children);
        }
    };
    fill(translation, source);
    return pairs;
}
/** The blocks holding `pos`, from the outermost to the innermost (inside boxes whose body is blocks). */
export function blockPathAt(blocks, pos) {
    const path = [];
    let level = blocks;
    while (level) {
        const found = level.find((block) => pos >= block.pos && pos < block.pos + block.size);
        if (!found)
            break;
        path.push(found);
        level = found.children;
    }
    return path;
}
/**
 * Where on screen the source point matching the translation's `line` is, for the pairs of one level in translation order (the innermost pair
 * holding the line decides). Within a block, the same fraction of the paired source block; above or below a block, the same distance from its
 * edge. `null` without pairs.
 */
export function sourceLineAt(pairs, line) {
    if (pairs.length === 0)
        return null;
    const found = pairs.findIndex((pair) => pair.translation.bottom > line);
    const pair = pairs[found === -1 ? pairs.length - 1 : found];
    const { translation, source } = pair;
    if (line >= translation.top && line < translation.bottom && pair.inner) {
        const inner = sourceLineAt(pair.inner(), line);
        if (inner !== null)
            return inner;
    }
    if (line < translation.top)
        return source.top - (translation.top - line);
    if (line >= translation.bottom)
        return source.bottom + (line - translation.bottom);
    const fraction = (line - translation.top) / (translation.bottom - translation.top);
    return source.top + fraction * (source.bottom - source.top);
}
/** The body of a box view (`data-node-view-content`) that belongs to the box itself, not to a box inside it. */
const ownBodyOf = (view) => Array.from(view.querySelectorAll("[data-node-view-content]")).find((body) => body.parentElement?.closest(".react-renderer") === view);
/** A source box shows its body as its paired translation box does: collapsed when that one is collapsed. Open state is view state only. */
export function followCollapsed(translationView, sourceView) {
    const sourceBody = ownBodyOf(sourceView);
    if (!sourceBody)
        return;
    const collapsed = ownBodyOf(translationView)?.hasAttribute(COLLAPSED_ATTRIBUTE) ?? false;
    if (collapsed !== sourceBody.hasAttribute(SOURCE_COLLAPSED_ATTRIBUTE))
        sourceBody.toggleAttribute(SOURCE_COLLAPSED_ATTRIBUTE, collapsed);
}
const highlightKey = new PluginKey("cmsSourceSyncHighlight");
/** Marks the block at a position with `ACTIVE_BLOCK_CLASS` (a decoration: the block's own DOM is ProseMirror's). */
/** The mark on the block at `pos`, or none when no block starts there. */
const highlightAt = (doc, pos) => {
    const node = pos === null ? null : doc.nodeAt(pos);
    return node && pos !== null && node.isBlock
        ? {
            pos,
            set: DecorationSet.create(doc, [Decoration.node(pos, pos + node.nodeSize, { class: ACTIVE_BLOCK_CLASS })]),
        }
        : { pos: null, set: DecorationSet.empty };
};
/**
 * Marks the block at a position with `ACTIVE_BLOCK_CLASS` (a decoration: the block's own DOM is ProseMirror's). After an edit the mark is made
 * again at the mapped position: a mapped node decoration is dropped when its block changes shape (a split).
 */
const highlightPlugin = () => new Plugin({
    key: highlightKey,
    state: {
        init: () => ({ pos: null, set: DecorationSet.empty }),
        apply: (tr, value) => {
            const meta = tr.getMeta(highlightKey);
            if (meta)
                return highlightAt(tr.doc, meta.pos);
            if (!tr.docChanged || value.pos === null)
                return value;
            const mapped = tr.mapping.mapResult(value.pos, 1);
            return highlightAt(tr.doc, mapped.deleted ? null : mapped.pos);
        },
    },
    props: { decorations: (state) => highlightKey.getState(state)?.set },
});
const highlight = (editor, pos) => {
    if (editor.isDestroyed || highlightKey.getState(editor.state)?.pos === pos)
        return;
    editor.view.dispatch(editor.state.tr.setMeta(highlightKey, { pos }).setMeta("addToHistory", false));
};
const editorOf = (root) => {
    const editor = root?.editor;
    return editor && !editor.isDestroyed ? editor : null;
};
const boxOf = (element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom };
};
/** Whether a block is laid out (not inside a collapsed box or a hidden tab). */
const isShown = (element) => element instanceof HTMLElement && element.getClientRects().length > 0 && element.getBoundingClientRect().height > 0;
/** Share of the remaining distance the source column moves each frame. */
const EASE = 0.3;
/** Whether an event is the user scrolling the translation (a wheel, a touch, a press on its scroll bar), not the editor keeping the cursor in view. */
const isUserScroll = (event, scroller) => event.type !== "pointerdown" || event.target === scroller;
/**
 * Links the translation editor (inside `editor`, its scrolling element) to the source column (`pane`, its scrolling element).
 * See the top of this file. The source column is never scrolled back into the translation.
 */
export function useSourceSync({ enabled, syncScroll, editor: scroller, pane, }) {
    useEffect(() => {
        if (!enabled || !scroller || !pane)
            return;
        let frame = 0;
        let motion = 0;
        let target = null;
        // Whether the cursor in the translation body leads (it moved last), rather than the middle line (scrolled last, or no cursor).
        let followCursor = false;
        let collapsedDirty = true;
        const registered = new Set();
        const withHighlight = (editor) => {
            if (editor && highlightKey.getState(editor.state) === undefined) {
                editor.registerPlugin(highlightPlugin());
                registered.add(editor);
            }
            return editor;
        };
        let blocksKey = null;
        let blocks = null;
        // Paired again only when either document changed (not on every scroll).
        const pairingOf = (translation, source) => {
            if (!blocks || blocksKey?.translation !== translation || blocksKey.source !== source) {
                const translationBlocks = syncBlocksOf(translation);
                blocks = { translation: translationBlocks, pairs: pairSyncBlocks(translationBlocks, syncBlocksOf(source)) };
                blocksKey = { translation, source };
                collapsedDirty = true;
            }
            return blocks;
        };
        const animate = () => {
            motion = 0;
            if (target === null)
                return;
            const max = Math.max(0, pane.scrollHeight - pane.clientHeight);
            const goal = Math.min(max, Math.max(0, target));
            const distance = goal - pane.scrollTop;
            const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
            if (Math.abs(distance) < 1 || reduced) {
                pane.scrollTop = goal;
                return;
            }
            pane.scrollTop += Math.sign(distance) * Math.max(1, Math.abs(distance) * EASE);
            motion = requestAnimationFrame(animate);
        };
        const moveTo = (next) => {
            target = next;
            if (motion === 0)
                motion = requestAnimationFrame(animate);
        };
        const run = () => {
            frame = 0;
            const translationEditor = withHighlight(editorOf(scroller.querySelector(".ProseMirror")));
            const sourceEditor = withHighlight(editorOf(pane.querySelector(".ProseMirror")));
            if (!translationEditor || !sourceEditor)
                return;
            const { translation, pairs } = pairingOf(translationEditor.state.doc, sourceEditor.state.doc);
            const translationView = translationEditor.view;
            const sourceView = sourceEditor.view;
            const domOf = (view, block) => view.nodeDOM(block.pos);
            if (collapsedDirty) {
                collapsedDirty = false;
                for (const [block, partner] of pairs) {
                    const translationDom = domOf(translationView, block);
                    const sourceDom = domOf(sourceView, partner);
                    if (translationDom?.classList.contains("react-renderer") && sourceDom?.classList.contains("react-renderer"))
                        followCollapsed(translationDom, sourceDom);
                }
            }
            // The innermost paired block holding the cursor, whose source block is shown.
            const cursorInBody = followCursor || translationEditor.isFocused;
            const anchor = cursorInBody
                ? blockPathAt(translation, translationEditor.state.selection.from)
                    .reverse()
                    .map((block) => ({ block, partner: pairs.get(block) }))
                    .find(({ partner }) => partner && isShown(domOf(sourceView, partner)))
                : undefined;
            highlight(translationEditor, anchor ? anchor.block.pos : null);
            highlight(sourceEditor, anchor?.partner ? anchor.partner.pos : null);
            if (!syncScroll)
                return;
            if (followCursor) {
                // A block with no pair (a new paragraph, the second part of a split one) leaves the source where it is.
                const translationDom = anchor ? domOf(translationView, anchor.block) : null;
                const sourceDom = anchor?.partner ? domOf(sourceView, anchor.partner) : null;
                if (translationDom && sourceDom)
                    moveTo(pane.scrollTop + sourceDom.getBoundingClientRect().top - translationDom.getBoundingClientRect().top);
                return;
            }
            const pairBoxes = (level) => level.flatMap((block) => {
                const partner = pairs.get(block);
                const translationDom = domOf(translationView, block);
                const sourceDom = partner ? domOf(sourceView, partner) : null;
                if (!isShown(translationDom) || !isShown(sourceDom))
                    return [];
                const children = block.children;
                return [
                    {
                        translation: boxOf(translationDom),
                        source: boxOf(sourceDom),
                        ...(children ? { inner: () => pairBoxes(children) } : {}),
                    },
                ];
            });
            const top = scroller.getBoundingClientRect().top;
            const toolbar = scroller.querySelector('[role="toolbar"]')?.getBoundingClientRect().height ?? 0;
            const line = top + toolbar + (scroller.clientHeight - toolbar) / 2;
            const sourceLine = sourceLineAt(pairBoxes(translation), line);
            if (sourceLine !== null)
                moveTo(pane.scrollTop + sourceLine - line);
        };
        const schedule = () => {
            if (frame === 0)
                frame = requestAnimationFrame(run);
        };
        const onSelection = () => {
            const anchorNode = document.getSelection()?.anchorNode ?? null;
            if (!anchorNode || !scroller.contains(anchorNode))
                return;
            // The cursor in the body leads; anywhere else on the editor side (the title) the middle line does.
            followCursor = Boolean(scroller.querySelector(".ProseMirror")?.contains(anchorNode));
            schedule();
        };
        const onUserScroll = (event) => {
            if (!isUserScroll(event, scroller))
                return;
            followCursor = false;
            schedule();
        };
        // A box opened or closed in the translation (its body's attribute), or any change of the body's DOM.
        const observer = new MutationObserver((records) => {
            if (records.some((record) => record.attributeName === COLLAPSED_ATTRIBUTE))
                collapsedDirty = true;
            schedule();
        });
        observer.observe(scroller, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: [COLLAPSED_ATTRIBUTE],
        });
        // The source column's editor is made after the column: align once it has its blocks.
        const paneObserver = new MutationObserver(() => schedule());
        paneObserver.observe(pane, { subtree: true, childList: true });
        scroller.addEventListener("scroll", schedule, { passive: true });
        scroller.addEventListener("wheel", onUserScroll, { passive: true });
        scroller.addEventListener("touchmove", onUserScroll, { passive: true });
        scroller.addEventListener("pointerdown", onUserScroll);
        document.addEventListener("selectionchange", onSelection);
        window.addEventListener("resize", schedule);
        schedule();
        return () => {
            if (frame)
                cancelAnimationFrame(frame);
            if (motion)
                cancelAnimationFrame(motion);
            observer.disconnect();
            paneObserver.disconnect();
            scroller.removeEventListener("scroll", schedule);
            scroller.removeEventListener("wheel", onUserScroll);
            scroller.removeEventListener("touchmove", onUserScroll);
            scroller.removeEventListener("pointerdown", onUserScroll);
            document.removeEventListener("selectionchange", onSelection);
            window.removeEventListener("resize", schedule);
            for (const editor of registered)
                if (!editor.isDestroyed)
                    editor.unregisterPlugin(highlightKey);
        };
    }, [enabled, syncScroll, scroller, pane]);
}
