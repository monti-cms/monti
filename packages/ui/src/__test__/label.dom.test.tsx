import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormFieldLabel } from "../field";
import { Input } from "../input";

describe("a required field label", () => {
	it("UI-A6 keeps its star out of the field's name, and leaves the requirement to the control", () => {
		render(
			<>
				<FormFieldLabel htmlFor="name" required>
					Name
				</FormFieldLabel>
				<Input id="name" required />
			</>,
		);
		expect(screen.getByRole("textbox", { name: "Name" }).hasAttribute("required")).toBe(true);
	});
});
