import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Affix } from "../affix";

describe("Affix", () => {
	const field = (props: Partial<React.ComponentProps<typeof Affix>> = {}) =>
		render(<Affix aria-label="Address" prefix="/" suffix="/:slug" defaultValue="posts" {...props} />);

	it("focuses the input with the caret at its end when the fixed suffix or prefix is clicked", () => {
		field();
		const input = screen.getByLabelText<HTMLInputElement>("Address");
		fireEvent.click(screen.getByText("/:slug"));
		expect(document.activeElement).toBe(input);
		expect(input.selectionStart).toBe(5);
		input.blur();
		fireEvent.click(screen.getByText("/"));
		expect(document.activeElement).toBe(input);
	});

	it("focuses the input when the empty space of the field is clicked", () => {
		const { container } = field();
		fireEvent.click(container.querySelector('[data-slot="affix"]') as Element);
		expect(document.activeElement).toBe(screen.getByLabelText("Address"));
	});

	it("leaves a click on the action to the action", () => {
		field({ action: <button type="button">Again</button> });
		fireEvent.click(screen.getByRole("button", { name: "Again" }));
		expect(document.activeElement).not.toBe(screen.getByLabelText("Address"));
	});

	it("does not focus a disabled input", () => {
		field({ disabled: true });
		fireEvent.click(screen.getByText("/:slug"));
		expect(document.activeElement).not.toBe(screen.getByLabelText("Address"));
	});

	it("is one tab stop: only the input is focusable, the fixed parts are not", () => {
		const { container } = field();
		expect(container.querySelectorAll("[tabindex], input, button, a")).toHaveLength(1);
	});
});
