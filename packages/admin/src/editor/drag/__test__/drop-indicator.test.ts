import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { buildEditorExtensions } from "../../extensions";
import { startBlockDrag } from "../drag-plugin";

const dragEvent = (type: string) => {
	const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
	const dataTransfer = { dropEffect: "", effectAllowed: "", setData: () => {} };
	Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
	return event;
};

describe("drop position indicator", () => {
	it("shows only positions where a drop is possible and blocks the default Dropcursor during block drag", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const editor = new Editor({
			element: host,
			extensions: buildEditorExtensions(testSite),
			content: "<p>가</p><p>나</p><p>다</p>",
		});
		const later = vi.fn();
		editor.view.dom.addEventListener("dragover", later);
		startBlockDrag(editor.view, 0, dragEvent("dragstart"));
		const posAtCoords = vi.spyOn(editor.view, "posAtCoords");

		// End of the document: can be moved.
		posAtCoords.mockReturnValue({ pos: editor.state.doc.content.size, inside: -1 });
		const valid = dragEvent("dragover");
		editor.view.dom.dispatchEvent(valid);
		expect(valid.dataTransfer?.dropEffect).toBe("move");
		expect(document.querySelectorAll("[data-cms-drop-indicator]")).toHaveLength(1);
		expect(later).not.toHaveBeenCalled();

		// Inside itself: cannot be dropped, so clear the indicator.
		posAtCoords.mockReturnValue({ pos: 1, inside: 0 });
		const invalid = dragEvent("dragover");
		editor.view.dom.dispatchEvent(invalid);
		expect(invalid.dataTransfer?.dropEffect).toBe("none");
		expect(document.querySelector("[data-cms-drop-indicator]")).toBeNull();
		expect(editor.state.doc.textContent).toBe("가나다");

		// Dropping again at a valid position moves it and clears the indicator.
		posAtCoords.mockReturnValue({ pos: editor.state.doc.content.size, inside: -1 });
		editor.view.dom.dispatchEvent(dragEvent("dragover"));
		editor.view.dom.dispatchEvent(dragEvent("drop"));
		expect(editor.state.doc.textContent).toBe("나다가");
		expect(document.querySelector("[data-cms-drop-indicator]")).toBeNull();
		editor.destroy();
		host.remove();
	});
});
