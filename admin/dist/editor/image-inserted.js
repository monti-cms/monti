/**
 * Runs the `editor.imageInserted` subscribers for an image that was just inserted, and keeps the state the image view shows while they run. Each
 * subscriber runs on its own: its failure clears its part of the "generating" state and shows a notice, and never touches the image or the others.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { errorText } from "../api/client.js";
import { findBlock } from "./block-ids.js";
/** Transactions that `fill` makes: they are not the person typing. */
const FILL_META = "cmsImageFill";
const FIELDS = ["alt", "caption"];
const running = new Map();
const listeners = new Set();
const notify = () => {
    for (const listener of listeners)
        listener();
};
const change = (blockId, by) => {
    const count = (running.get(blockId) ?? 0) + by;
    if (count > 0)
        running.set(blockId, count);
    else
        running.delete(blockId);
    notify();
};
const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
/** Whether subscribers of `editor.imageInserted` are still running for the image with this block id. */
export function useImageGenerating(blockId) {
    return useSyncExternalStore(subscribe, () => (blockId ? running.has(blockId) : false), () => false);
}
const textOf = (value) => (typeof value === "string" ? value : "");
const nodeOf = (doc, blockId) => {
    const pos = findBlock(doc, blockId);
    if (pos === undefined)
        return null;
    const node = doc.nodeAt(pos);
    return node?.type.name === "image" ? { node, pos } : null;
};
/** Body text before and after the node, its place marked by a line of its own. */
const textAround = (doc, pos, size, marker, chars = 1500) => {
    const before = doc.textBetween(Math.max(0, pos - chars), pos, "\n", " ");
    const after = doc.textBetween(pos + size, Math.min(doc.content.size, pos + size + chars), "\n", " ");
    return `${before.trim()}\n${marker}\n${after.trim()}`;
};
export function runImageInserted({ editor, blockId, subscribers, site, marker, failed, }) {
    const found = nodeOf(editor.state.doc, blockId);
    if (!found || subscribers.length === 0)
        return;
    const controller = new AbortController();
    const touched = new Set();
    let last = { alt: textOf(found.node.attrs.alt), caption: textOf(found.node.attrs.caption) };
    // The person's own edits of the fields, and the removal of the image, from every change while subscribers run.
    const watch = ({ transaction }) => {
        if (!transaction.docChanged)
            return;
        const current = nodeOf(editor.state.doc, blockId);
        if (!current) {
            controller.abort();
            return;
        }
        const now = { alt: textOf(current.node.attrs.alt), caption: textOf(current.node.attrs.caption) };
        if (!transaction.getMeta(FILL_META)) {
            for (const field of FIELDS)
                if (now[field] !== last[field])
                    touched.add(field);
        }
        last = now;
    };
    const abort = () => controller.abort();
    editor.on("transaction", watch);
    editor.on("destroy", abort);
    const fill = (values) => {
        if (controller.signal.aborted || editor.isDestroyed)
            return false;
        const current = nodeOf(editor.state.doc, blockId);
        if (!current)
            return false;
        const attrs = {};
        for (const field of FIELDS) {
            const value = values[field]?.trim();
            if (!value || touched.has(field) || textOf(current.node.attrs[field]))
                continue;
            if (field === "alt" && current.node.attrs.decorative === true)
                continue;
            attrs[field] = value;
        }
        if (Object.keys(attrs).length === 0)
            return false;
        const transaction = editor.state.tr
            .setNodeMarkup(current.pos, undefined, { ...current.node.attrs, ...attrs })
            .setMeta(FILL_META, true);
        editor.view.dispatch(transaction);
        return true;
    };
    const event = {
        image: {
            ...(textOf(found.node.attrs.mediaId) ? { mediaId: textOf(found.node.attrs.mediaId) } : {}),
            ...(textOf(found.node.attrs.src) ? { src: textOf(found.node.attrs.src) } : {}),
            alt: last.alt,
            caption: last.caption,
            decorative: found.node.attrs.decorative === true,
        },
        around: textAround(editor.state.doc, found.pos, found.node.nodeSize, marker),
        site,
        signal: controller.signal,
        fill,
    };
    change(blockId, subscribers.length);
    let left = subscribers.length;
    for (const subscriber of subscribers) {
        Promise.resolve()
            .then(() => subscriber(event))
            .catch((error) => {
            if (controller.signal.aborted)
                return;
            console.error("[cms] editor.imageInserted subscriber failed", error);
            toast.error(failed, { description: errorText(site, error, "") || undefined });
        })
            .finally(() => {
            change(blockId, -1);
            left -= 1;
            if (left > 0)
                return;
            editor.off("transaction", watch);
            editor.off("destroy", abort);
        });
    }
}
