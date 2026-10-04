import { createTranslator } from "@monti-cms/core/client";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BlockHandleOverlay } from "../block-handle-overlay";
import { editorMessages } from "../messages";

const t = createTranslator(editorMessages);

describe("BlockHandleOverlay DropdownMenu 및 드래그 동작(v2 C1)", () => {
	it("핸들 버튼이 draggable이고 dragstart/dragend 이벤트를 전달한다", () => {
		const onDragStart = vi.fn();
		const onDragEnd = vi.fn();

		render(
			<BlockHandleOverlay
				coords={{ top: 100, left: 50 }}
				onMoveUp={vi.fn()}
				onMoveDown={vi.fn()}
				onDuplicate={vi.fn()}
				onDelete={vi.fn()}
				onDragStart={onDragStart}
				onDragEnd={onDragEnd}
			/>,
		);

		const trigger = screen.getByRole("button", { name: t("blockHandle.label") });
		expect(trigger.getAttribute("draggable")).toBe("true");

		fireEvent.dragStart(trigger, {
			dataTransfer: {
				setData: vi.fn(),
				effectAllowed: "none",
			},
		});
		expect(onDragStart).toHaveBeenCalledOnce();

		fireEvent.dragEnd(trigger);
		expect(onDragEnd).toHaveBeenCalledOnce();
	});

	it("핸들 클릭 시 Base UI DropdownMenu가 열려 각 동작(이동/복제/삭제)을 수행한다", async () => {
		const onMoveUp = vi.fn();
		const onMoveDown = vi.fn();
		const onDuplicate = vi.fn();
		const onDelete = vi.fn();

		const { unmount } = render(
			<BlockHandleOverlay
				coords={{ top: 100, left: 50 }}
				onMoveUp={onMoveUp}
				onMoveDown={onMoveDown}
				onDuplicate={onDuplicate}
				onDelete={onDelete}
			/>,
		);

		const trigger = screen.getByRole("button", { name: t("blockHandle.label") });
		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");

		const upItem = await screen.findByRole("menuitem", { name: new RegExp(t("blockHandle.moveUp")) });
		fireEvent.click(upItem);
		expect(onMoveUp).toHaveBeenCalledOnce();

		// 다음 메뉴 아이템 테스트를 위해 다시 클릭
		fireEvent.click(trigger);
		const downItem = await screen.findByRole("menuitem", { name: new RegExp(t("blockHandle.moveDown")) });
		fireEvent.click(downItem);
		expect(onMoveDown).toHaveBeenCalledOnce();

		fireEvent.click(trigger);
		const dupItem = await screen.findByRole("menuitem", { name: new RegExp(t("blockHandle.duplicate")) });
		fireEvent.click(dupItem);
		expect(onDuplicate).toHaveBeenCalledOnce();

		fireEvent.click(trigger);
		const delItem = await screen.findByRole("menuitem", { name: new RegExp(t("blockHandle.delete")) });
		fireEvent.click(delItem);
		expect(onDelete).toHaveBeenCalledOnce();

		unmount();
	});
});
