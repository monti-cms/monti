import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";

/** Base UI 항목은 포인터 순서(누름 → 뗌 → 클릭)로 고른다. jsdom의 `click` 하나로는 선택되지 않는다. */
export function pressOption(option: HTMLElement) {
	fireEvent.pointerDown(option);
	fireEvent.mouseDown(option);
	fireEvent.pointerUp(option);
	fireEvent.mouseUp(option);
	fireEvent.click(option);
}

/** shadcn Select(Base UI): 트리거를 열고 이름으로 항목을 고른 뒤 트리거에 반영될 때까지 기다린다. */
export async function chooseSelectOption(triggerName: string | RegExp, optionName: string) {
	const trigger = screen.getByRole("combobox", { name: triggerName });
	fireEvent.click(trigger);
	pressOption(await screen.findByRole("option", { name: optionName }));
	await waitFor(() => expect(trigger.textContent).toContain(optionName));
}

/** shadcn Combobox(Base UI): 입력칸에서 ↓로 목록을 열고 항목을 고른다. Combobox 항목은 `click` 하나로 토글된다. */
export async function chooseComboboxOption(inputName: string | RegExp, optionName: string) {
	const input = await screen.findByRole("combobox", { name: inputName });
	input.focus();
	fireEvent.keyDown(input, { key: "ArrowDown" });
	fireEvent.click(await screen.findByRole("option", { name: optionName }));
	// 다중 선택은 고른 뒤에도 목록이 열려 있고, 열린 동안 바깥은 접근성 트리에서 숨겨진다.
	fireEvent.keyDown(input, { key: "Escape" });
	await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}
