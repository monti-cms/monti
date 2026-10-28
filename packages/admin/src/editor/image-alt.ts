import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import { useSyncExternalStore } from "react";
import { BLOCK_ID_ATTRIBUTE } from "./block-ids";

/**
 * Moving through the images that still have no alt text: the "next image" of the image card, and the way a list of to-dos opens the card of the first one.
 * An image that is decorative, or that is still going up, needs no text.
 */

const needsAlt = (node: ProseMirrorNode): boolean =>
	node.type.name === "image" &&
	!node.attrs.uploadId &&
	node.attrs.decorative !== true &&
	!String(node.attrs.alt ?? "").trim();

/** The block ids of the images without alt text, in the order of the document. */
export function imagesWithoutAlt(doc: ProseMirrorNode): string[] {
	const ids: string[] = [];
	doc.descendants((node) => {
		const id = node.attrs[BLOCK_ID_ATTRIBUTE];
		if (needsAlt(node) && typeof id === "string" && id) ids.push(id);
		return true;
	});
	return ids;
}

/** The image to go to after `blockId`: the next one without alt text, or the first one when there is none after it. `null` if no other image needs text. */
export function nextImageWithoutAlt(doc: ProseMirrorNode, blockId: string): string | null {
	const ids = imagesWithoutAlt(doc);
	const others = ids.filter((id) => id !== blockId);
	if (others.length === 0) return null;
	const order: string[] = [];
	doc.descendants((node) => {
		const id = node.attrs[BLOCK_ID_ATTRIBUTE];
		if (node.type.name === "image" && typeof id === "string") order.push(id);
		return true;
	});
	const after = order.slice(order.indexOf(blockId) + 1).find((id) => others.includes(id));
	return after ?? others[0] ?? null;
}

// Which image card is asked to open. A card that is not on screen yet opens when its image is drawn.
let requested: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};
const notify = () => {
	for (const listener of listeners) listener();
};

/** Selects the image with this block id and asks its card to open, with the cursor in the alt text. */
export function openImageCard(editor: Editor, blockId: string): boolean {
	let found: number | undefined;
	editor.state.doc.descendants((node, pos) => {
		if (found !== undefined) return false;
		if (node.type.name === "image" && node.attrs[BLOCK_ID_ATTRIBUTE] === blockId) found = pos;
		return found === undefined;
	});
	if (found === undefined) return false;
	editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, found)).scrollIntoView());
	requested = blockId;
	notify();
	return true;
}

/** Whether the card of this image is asked to open. Read it once it is open, and `acknowledgeImageCard` to say it has. */
export function useImageCardRequested(blockId: string | null | undefined): boolean {
	return useSyncExternalStore(
		subscribe,
		() => Boolean(blockId) && requested === blockId,
		() => false,
	);
}

export function acknowledgeImageCard(blockId: string): void {
	if (requested !== blockId) return;
	requested = null;
	notify();
}
