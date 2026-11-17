import type { Editor } from "@tiptap/react";

/**
 * The editor's text element while its view is there, or `null`: not mounted yet, or destroyed (the editor made again, or its screen left). tiptap
 * throws on any read of a view that is not there, so what listens to the element takes it once, here, and lets go of that same element.
 */
export function liveDom(editor: Editor | null): HTMLElement | null {
	return editor && !editor.isDestroyed ? editor.view.dom : null;
}
