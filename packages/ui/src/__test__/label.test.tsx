import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormFieldLabel } from "../field";
import { Input } from "../input";

describe("a required field label", () => {
	it("ends with a decorative red star and leaves the requirement to the control", () => {
		render(
			<>
				<FormFieldLabel htmlFor="name" required>
					Name
				</FormFieldLabel>
				<Input id="name" required />
			</>,
		);
		const star = document.querySelector("[data-slot=field-label] [aria-hidden=true]");
		expect(star?.textContent).toBe("*");
		expect(star?.className).toContain("text-monti-danger");
		// The accessible name is the text alone; the control carries the requirement.
		expect(screen.getByRole("textbox", { name: "Name" }).hasAttribute("required")).toBe(true);
	});

	it("shows no star by default", () => {
		render(<FormFieldLabel htmlFor="x">Name</FormFieldLabel>);
		expect(document.querySelector("[aria-hidden=true]")).toBeNull();
	});
});
