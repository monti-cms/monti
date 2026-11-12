import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { Button, DropdownMenuItem, SplitButton, TextButton } from "./index";

/** A button that starts working when it is pressed, as a save does; `presses` counts what reached its handler. */
function Working({ part }: { part: "button" | "text" | "split" }) {
	const [busy, setBusy] = useState(false);
	const [presses, setPresses] = useState(0);
	const press = () => {
		setPresses((count) => count + 1);
		setBusy(true);
	};
	return (
		<>
			{part === "button" ? (
				<Button loading={busy} onClick={press}>
					{busy ? "저장 중…" : "저장"}
				</Button>
			) : part === "text" ? (
				<TextButton loading={busy} onClick={press}>
					{busy ? "저장 중…" : "다시 저장"}
				</TextButton>
			) : (
				<SplitButton
					loading={busy}
					onClick={press}
					menuLabel="다른 방법"
					menu={<DropdownMenuItem>오늘 날짜로 다시 발행</DropdownMenuItem>}
				>
					{busy ? "발행 중…" : "발행"}
				</SplitButton>
			)}
			<output aria-label="presses">{presses}</output>
		</>
	);
}

describe("a button while it works", () => {
	for (const [part, idle, working] of [
		["button", "저장", "저장 중…"],
		["text", "다시 저장", "저장 중…"],
		["split", "발행", "발행 중…"],
	] as const)
		it(`${part}: pressed from the keyboard it keeps the focus while it works, is not dimmed, and takes no second press`, async () => {
			render(<Working part={part} />);
			const button = page.getByRole("button", { name: idle });
			await expect.element(button).toBeVisible();
			(button.element() as HTMLElement).focus();
			await userEvent.keyboard("{Enter}");
			const busy = page.getByRole("button", { name: working });
			await expect.element(busy).toHaveAttribute("aria-busy", "true");
			// The focus did not fall to the page: the next Tab goes on from the button, and a screen reader hears what it became.
			expect(document.activeElement).toBe(busy.element());
			await expect.element(busy).toHaveAttribute("aria-disabled", "true");
			await expect.element(busy).not.toHaveAttribute("disabled");
			expect(getComputedStyle(busy.element()).opacity).toBe("1");
			// A second press, by key and by pointer, starts nothing.
			await userEvent.keyboard("{Enter}");
			await userEvent.keyboard(" ");
			await busy.click({ force: true }).catch(() => {});
			await expect.element(page.getByLabelText("presses")).toHaveTextContent("1");
		});
});
