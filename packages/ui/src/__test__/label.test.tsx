import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormFieldLabel } from "../field";
import { Input } from "../input";

describe("a required field label", () => {
	it("ends with a decorative star and leaves the requirement to the control; without it there is no star", () => {
		const { rerender } = render(
			<>
				<FormFieldLabel htmlFor="name">Name</FormFieldLabel>
				<Input id="name" />
			</>,
		);
		expect(document.querySelector("[aria-hidden=true]")).toBeNull();
		rerender(
			<>
				<FormFieldLabel htmlFor="name" required>
					Name
				</FormFieldLabel>
				<Input id="name" required />
			</>,
		);
		const star = document.querySelector("[data-slot=field-label] [aria-hidden=true]");
		expect(star?.textContent).toBe("*");
		// The accessible name is the text alone; the control carries the requirement.
		expect(screen.getByRole("textbox", { name: "Name" }).hasAttribute("required")).toBe(true);
	});
});
