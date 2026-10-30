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
	it("fires onClick from the main half only", () => {
		const onClick = vi.fn();
		renderSplit({ onClick });
		fireEvent.click(screen.getByRole("button", { name: "Publish options" }));
		expect(onClick).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Publish" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("is two buttons, both in the tab order, and opens the menu from the trigger", async () => {
		renderSplit();
		for (const name of ["Publish", "Publish options"])
			expect(screen.getByRole("button", { name }).getAttribute("tabindex")).not.toBe("-1");
		const trigger = screen.getByRole("button", { name: "Publish options" });
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
		fireEvent.click(trigger);
		expect(await screen.findByRole("menuitem", { name: "Republish" })).toBeInTheDocument();
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
