import { render, screen } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { describe, expect, it } from "vitest";
import { IconButton } from "../icon-button";
import { TooltipProvider } from "../tooltip";

const renderButton = (tone?: "danger") =>
	render(
		<TooltipProvider>
			<IconButton label="Delete row" tone={tone}>
				<Trash2 aria-hidden />
			</IconButton>
		</TooltipProvider>,
	);

describe("IconButton tone", () => {
	// A button that deletes or removes something is red; every delete icon of the editor and the admin passes `tone="danger"`.
	it("paints a danger button with the danger text and its red wash on hover", () => {
		renderButton("danger");
		const button = screen.getByRole("button", { name: "Delete row" });
		expect(button.getAttribute("data-tone")).toBe("danger");
		expect(button.className).toContain("data-[tone=danger]:text-monti-danger");
		expect(button.className).toContain("data-[tone=danger]:hover:bg-monti-danger-muted");
	});

	it("leaves a plain button gray", () => {
		renderButton();
		expect(screen.getByRole("button", { name: "Delete row" }).hasAttribute("data-tone")).toBe(false);
	});
});
