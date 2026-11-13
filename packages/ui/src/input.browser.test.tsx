import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { IconButton } from "./icon-button";
import { Settings } from "./icons";
import { Input } from "./input";

it("a read-only input keeps its line as it is under the pointer and the focus, with or without an action at its end", async () => {
	render(
		<>
			<Input aria-label="대체 텍스트" readOnly defaultValue="아침 책상" />
			<Input
				aria-label="주소"
				readOnly
				defaultValue="first-post"
				action={
					<IconButton label="설정">
						<Settings aria-hidden />
					</IconButton>
				}
			/>
		</>,
	);
	for (const name of ["대체 텍스트", "주소"]) {
		const input = page.getByRole("textbox", { name });
		await expect.element(input).toBeVisible();
		// The line is on the input, or on the line around it when it has an action.
		const line = input.element().closest("[data-slot=input-line]") ?? input.element();
		const resting = getComputedStyle(line);
		const before = { color: resting.borderBottomColor, ground: resting.backgroundColor };
		await userEvent.hover(input);
		await userEvent.click(input);
		await expect.element(input).toHaveFocus();
		await userEvent.keyboard("{Tab}{Shift>}{Tab}{/Shift}");
		await expect.element(input).toHaveFocus();
		const now = getComputedStyle(line);
		expect({ color: now.borderBottomColor, ground: now.backgroundColor }).toEqual(before);
	}
});
