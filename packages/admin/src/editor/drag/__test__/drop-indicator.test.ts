import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { buildEditorExtensions } from "../../extensions";
import { startBlockDrag } from "../drag-plugin";

const dragEvent = (type: string) => {
	const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
	const dataTransfer = { dropEffect: "", effectAllowed: "", setData: () => {} };
	Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
	return event;
};

describe("C1 드롭 위치 표시", () => {
	it("놓을 수 있는 위치만 표시하고 기본 Dropcursor는 블록 드래그에서 막는다", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const editor = new Editor({
			element: host,
			extensions: buildEditorExtensions(),
			content: "<p>가</p><p>나</p><p>다</p>",
		});
		const later = vi.fn();
		editor.view.dom.addEventListener("dragover", later);
		startBlockDrag(editor.view, 0, dragEvent("dragstart"));
		const posAtCoords = vi.spyOn(editor.view, "posAtCoords");

		// 문서 끝: 옮길 수 있다.
		posAtCoords.mockReturnValue({ pos: editor.state.doc.content.size, inside: -1 });
		const valid = dragEvent("dragover");
		editor.view.dom.dispatchEvent(valid);
		expect(valid.dataTransfer?.dropEffect).toBe("move");
		expect(document.querySelectorAll("[data-cms-drop-indicator]")).toHaveLength(1);
		expect(later).not.toHaveBeenCalled();

		// 자기 자신 안쪽: 놓을 수 없으므로 표시를 지운다.
		posAtCoords.mockReturnValue({ pos: 1, inside: 0 });
		const invalid = dragEvent("dragover");
		editor.view.dom.dispatchEvent(invalid);
		expect(invalid.dataTransfer?.dropEffect).toBe("none");
		expect(document.querySelector("[data-cms-drop-indicator]")).toBeNull();
		expect(editor.state.doc.textContent).toBe("가나다");

		// 다시 유효한 위치에서 놓으면 옮기고 표시를 지운다.
		posAtCoords.mockReturnValue({ pos: editor.state.doc.content.size, inside: -1 });
		editor.view.dom.dispatchEvent(dragEvent("dragover"));
		editor.view.dom.dispatchEvent(dragEvent("drop"));
		expect(editor.state.doc.textContent).toBe("나다가");
		expect(document.querySelector("[data-cms-drop-indicator]")).toBeNull();
		editor.destroy();
		host.remove();
	});
});
