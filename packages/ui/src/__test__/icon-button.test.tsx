import { TrashCan } from "@carbon/icons-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconButton } from "../icon-button";
import { TooltipProvider } from "../tooltip";

const button = (tone?: "danger") => (
	<TooltipProvider>
		<IconButton label="Delete row" tone={tone}>
			<TrashCan aria-hidden />
		</IconButton>
	</TooltipProvider>
);

describe("IconButton tone", () => {
	// A button that deletes or removes something is red; every delete icon of the editor and the admin passes `tone="danger"`.
	it("marks a danger button with its tone, and leaves a plain one without", () => {
		const { rerender } = render(button("danger"));
		expect(screen.getByRole("button", { name: "Delete row" }).getAttribute("data-tone")).toBe("danger");
		rerender(button());
		expect(screen.getByRole("button", { name: "Delete row" }).hasAttribute("data-tone")).toBe(false);
	});
});
