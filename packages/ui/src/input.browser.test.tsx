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

it("[T276] a `mono` input types its value in mono and keeps its placeholder, which is words, in the sans face", async () => {
	render(
		<>
			<Input aria-label="주소" mono placeholder="공개 주소에서" defaultValue="first-post" />
			<Input aria-label="비어 있는 주소" mono placeholder="공개 주소에서" />
		</>,
	);
	const typed = page.getByRole("textbox", { name: "주소", exact: true });
	const empty = page.getByRole("textbox", { name: "비어 있는 주소" });
	await expect.element(typed).toBeVisible();
	const mono = getComputedStyle(typed.element()).fontFamily;
	// The value is in the mono face; the placeholder is the page's own sans face.
	expect(mono).toMatch(/mono|Mono|monospace/i);
	const holder = getComputedStyle(empty.element(), "::placeholder").fontFamily;
	expect(holder).not.toBe(mono);
	expect(holder).not.toMatch(/mono|Mono|monospace/i);
});
