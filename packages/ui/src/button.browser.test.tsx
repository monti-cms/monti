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
			// Not the hand of something to press: its own "cannot be pressed" cursor, or none of its own (the pointer goes through it).
			const look = getComputedStyle(busy.element());
			expect(look.cursor === "pointer" && look.pointerEvents !== "none").toBe(false);
			// A second press, by key and by pointer, starts nothing.
			await userEvent.keyboard("{Enter}");
			await userEvent.keyboard(" ");
			await busy.click({ force: true }).catch(() => {});
			await expect.element(page.getByLabelText("presses")).toHaveTextContent("1");
		});

	/** Presses a control every way a person can: the pointer, Enter and Space with the keyboard in it. */
	const pressEveryWay = async (control: HTMLElement) => {
		control.click();
		control.focus();
		await userEvent.keyboard("{Enter}");
		await userEvent.keyboard(" ");
	};

	for (const part of ["button", "text"] as const) {
		const Part = part === "button" ? Button : TextButton;

		it(`${part}: drawn over the caller's own button, that button's handler does not run while it works`, async () => {
			let ran = 0;
			const own = (
				<button
					type="button"
					onClick={() => {
						ran += 1;
					}}
				/>
			);
			render(
				<Part loading render={own}>
					저장 중…
				</Part>,
			);
			const busy = page.getByRole("button", { name: "저장 중…" });
			await expect.element(busy).toHaveAttribute("aria-busy", "true");
			await pressEveryWay(busy.element() as HTMLElement);
			expect(ran).toBe(0);
		});

		it(`${part}: drawn as a link (an address, a router's link with its own handler), it does not go anywhere while it works`, async () => {
			let ran = 0;
			const before = window.location.hash;
			const link = (
				// biome-ignore lint/a11y/useAnchorContent: the part's children go in the link.
				// biome-ignore lint/a11y/useValidAnchor: a router's link, which has a handler of its own beside its address.
				<a
					href="#/elsewhere"
					onClick={() => {
						ran += 1;
					}}
				/>
			);
			render(
				<>
					<Part loading href="#/by-address">
						주소로 가는 중…
					</Part>
					{part === "button" ? (
						<Button loading nativeButton={false} render={link}>
							링크로 가는 중…
						</Button>
					) : (
						<TextButton loading render={link}>
							링크로 가는 중…
						</TextButton>
					)}
				</>,
			);
			for (const name of ["주소로 가는 중…", "링크로 가는 중…"]) {
				const busy = page.getByText(name);
				await expect.element(busy).toBeVisible();
				await pressEveryWay(busy.element().closest("a") as HTMLElement);
			}
			expect(ran).toBe(0);
			expect(window.location.hash).toBe(before);
		});

		it(`${part}: the submit button of a form, it does not let Enter in a field send the form while it works`, async () => {
			let sent = 0;
			render(
				<form
					onSubmit={(event) => {
						event.preventDefault();
						sent += 1;
					}}
				>
					<input aria-label="이름" />
					<Part type="submit" loading>
						저장 중…
					</Part>
				</form>,
			);
			const field = page.getByRole("textbox", { name: "이름" });
			await expect.element(field).toBeVisible();
			(field.element() as HTMLElement).focus();
			await userEvent.keyboard("{Enter}");
			await pressEveryWay(page.getByRole("button", { name: "저장 중…" }).element() as HTMLElement);
			expect(sent).toBe(0);
		});
	}
});
