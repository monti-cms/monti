import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Affix } from "../affix";

describe("Affix", () => {
	const field = (props: Partial<React.ComponentProps<typeof Affix>> = {}) =>
		render(<Affix aria-label="Address" prefix="/" suffix="/:slug" defaultValue="posts" {...props} />);

	it("UI-K1 focuses the input with the caret at its end when a fixed part is clicked", () => {
		field();
		const input = screen.getByLabelText<HTMLInputElement>("Address");
		fireEvent.click(screen.getByText("/:slug"));
		expect(document.activeElement).toBe(input);
		expect(input.selectionStart).toBe(5);
		input.blur();
		fireEvent.click(screen.getByText("/"));
		expect(document.activeElement).toBe(input);
	});

	it("UI-K1 leaves a click on the action to the action", () => {
		field({ action: <button type="button">Again</button> });
		fireEvent.click(screen.getByRole("button", { name: "Again" }));
		expect(document.activeElement).not.toBe(screen.getByLabelText("Address"));
	});
});
