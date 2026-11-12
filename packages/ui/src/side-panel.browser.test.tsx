import { useState } from "react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { Button, SidePanel, TextButton } from "./index";

/** Two rows that each open the panel beside them, as a list's rows do. */
function Screen() {
	const [open, setOpen] = useState<string | null>(null);
	return (
		<>
			<Button onClick={() => setOpen("첫 번째")}>첫 번째 열기</Button>
			<Button onClick={() => setOpen("두 번째")}>두 번째 열기</Button>
			{open && (
				<SidePanel title={open} onClose={() => setOpen(null)}>
					<TextButton>패널 안의 동작</TextButton>
				</SidePanel>
			)}
		</>
	);
}

const opener = (name: string) => page.getByRole("button", { name });
const close = () => page.getByRole("complementary").getByRole("button", { name: "Close" });

describe("SidePanel", () => {
	it("closed with the keyboard, it gives focus back to what opened it", async () => {
		render(<Screen />);
		await expect.element(opener("두 번째 열기")).toBeVisible();
		(opener("두 번째 열기").element() as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("complementary")).toBeVisible();
		// Into the panel with Tab, to its ×.
		await userEvent.tab();
		await userEvent.tab();
		await expect.element(close()).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("complementary")).not.toBeInTheDocument();
		await expect.element(opener("두 번째 열기")).toHaveFocus();
	});

	it("focus that came into it from somewhere else goes back there, not to the first opener", async () => {
		render(<Screen />);
		await userEvent.click(opener("첫 번째 열기"));
		await expect.element(page.getByRole("complementary")).toBeVisible();
		// The person goes on to another control, then into the panel from there.
		(opener("두 번째 열기").element() as HTMLElement).focus();
		await userEvent.tab();
		await userEvent.tab();
		await expect.element(close()).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect.element(opener("두 번째 열기")).toHaveFocus();
	});

	it("closed with the pointer, it moves focus nowhere", async () => {
		render(<Screen />);
		await userEvent.click(opener("첫 번째 열기"));
		await userEvent.click(close());
		await expect.element(page.getByRole("complementary")).not.toBeInTheDocument();
		expect(document.activeElement).toBe(document.body);
	});
});
