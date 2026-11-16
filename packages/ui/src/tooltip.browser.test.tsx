import { expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { IconButton } from "./icon-button";
import { OverflowMenuHorizontal } from "./icons";

it("an open tooltip lets a press through to what is under it: the ⋯ of the row above takes the click", async () => {
	const above = vi.fn();
	render(
		// Two rows' ⋯ at a list's row pitch: the lower one's name, above it, covers the upper one.
		<div className="flex flex-col p-monti-48" style={{ gap: 41 - 32 }}>
			<IconButton label="위 행" onClick={above}>
				<OverflowMenuHorizontal />
			</IconButton>
			<IconButton label="아래 행">
				<OverflowMenuHorizontal />
			</IconButton>
		</div>,
	);
	await expect.element(page.getByRole("button", { name: "아래 행" })).toBeVisible();
	await userEvent.keyboard("{Tab}{Tab}");
	await expect.element(page.getByRole("tooltip")).toHaveTextContent("아래 행");
	const upper = page.getByRole("button", { name: "위 행" }).element().getBoundingClientRect();
	const tip = page.getByRole("tooltip").element().getBoundingClientRect();
	expect(tip.bottom, "the tooltip stands over the button above").toBeGreaterThan(upper.top + upper.height / 2);
	await userEvent.click(page.getByRole("button", { name: "위 행" }), { timeout: 2000 });
	expect(above).toHaveBeenCalledTimes(1);
});
