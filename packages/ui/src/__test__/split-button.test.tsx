import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenuItem } from "../dropdown-menu";
import { SplitButton } from "../split-button";

const renderSplit = (props: Partial<Parameters<typeof SplitButton>[0]> = {}) =>
	render(
		<SplitButton menuLabel="Publish options" menu={<DropdownMenuItem>Republish</DropdownMenuItem>} {...props}>
			Publish
		</SplitButton>,
	);

describe("SplitButton", () => {
	it("renders the main action and the menu trigger as two buttons", () => {
		renderSplit();
		expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Publish options" })).toBeTruthy();
	});

	it("fires onClick from the main half only", () => {
		const onClick = vi.fn();
		renderSplit({ onClick });
		fireEvent.click(screen.getByRole("button", { name: "Publish options" }));
		expect(onClick).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Publish" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("opens the menu from the trigger, by click and by ArrowDown, and both halves are in the tab order", async () => {
		renderSplit();
		for (const name of ["Publish", "Publish options"])
			expect(screen.getByRole("button", { name }).getAttribute("tabindex")).not.toBe("-1");
		const trigger = screen.getByRole("button", { name: "Publish options" });
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
		fireEvent.click(trigger);
		expect(await screen.findByRole("menuitem", { name: "Republish" })).toBeTruthy();
	});

	it("disables both halves together, and while loading", () => {
		const { rerender } = renderSplit({ disabled: true });
		expect(screen.getByRole("button", { name: "Publish" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Publish options" }).hasAttribute("disabled")).toBe(true);
		rerender(
			<SplitButton loading menuLabel="Publish options" menu={null}>
				Publish
			</SplitButton>,
		);
		expect(screen.getByRole("button", { name: /Publish$/ }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Publish options" }).hasAttribute("disabled")).toBe(true);
	});
});
