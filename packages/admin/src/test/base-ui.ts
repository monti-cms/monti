import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";

/** Base UI items are chosen by pointer sequence (down, up, click). A single jsdom `click` does not select them. */
export function pressOption(option: HTMLElement) {
	fireEvent.pointerDown(option);
	fireEvent.mouseDown(option);
	fireEvent.pointerUp(option);
	fireEvent.mouseUp(option);
	fireEvent.click(option);
}

/** shadcn Select (Base UI): opens the trigger, picks an item by name, then waits until the trigger reflects it. */
export async function chooseSelectOption(triggerName: string | RegExp, optionName: string) {
	const trigger = screen.getByRole("combobox", { name: triggerName });
	fireEvent.click(trigger);
	pressOption(await screen.findByRole("option", { name: optionName }));
	await waitFor(() => expect(trigger.textContent).toContain(optionName));
}

/** shadcn Combobox (Base UI): opens the list with ArrowDown in the input and picks an item. Combobox items toggle with a single `click`. */
export async function chooseComboboxOption(inputName: string | RegExp, optionName: string) {
	const input = await screen.findByRole("combobox", { name: inputName });
	input.focus();
	fireEvent.keyDown(input, { key: "ArrowDown" });
	fireEvent.click(await screen.findByRole("option", { name: optionName }));
	// Multi-select keeps the list open after a pick, and while it is open the outside is hidden from the accessibility tree.
	fireEvent.keyDown(input, { key: "Escape" });
	await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}
