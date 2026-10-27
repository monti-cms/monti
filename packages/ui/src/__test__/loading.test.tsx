import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";
import { AiAction } from "../ai-action";
import { Button } from "../button";
import { SplitButton } from "../split-button";

const spinners = (root: ParentNode = document) => root.querySelectorAll("[data-slot=spinner]");

describe("loading controls show a spinner", () => {
	it("a loading Button puts the spinner first, hides its leading icon, and cannot be pressed", () => {
		render(
			<Button loading>
				<Search data-testid="icon" aria-hidden />
				Saving…
			</Button>,
		);
		const button = screen.getByRole("button", { name: /Saving/ });
		expect(button.firstElementChild?.getAttribute("data-slot")).toBe("spinner");
		expect(spinners(button)).toHaveLength(1);
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.hasAttribute("disabled")).toBe(true);
		expect(button.className).toContain("data-loading:[&>[data-slot=spinner]+svg]:hidden");
	});

	it("an idle Button has no spinner", () => {
		render(<Button>Save</Button>);
		expect(spinners()).toHaveLength(0);
	});

	it("a loading SplitButton shows the spinner in its main half only", () => {
		render(
			<SplitButton loading menuLabel="Options" menu={null}>
				Publishing
			</SplitButton>,
		);
		expect(spinners(screen.getByRole("button", { name: /Publishing/ }))).toHaveLength(1);
		expect(spinners()).toHaveLength(1);
	});

	it("a loading AiAction replaces its mark with the spinner and the working label, and keeps its color", () => {
		const { rerender } = render(<AiAction />);
		expect(screen.getByRole("button").textContent).toBe("Fill");
		rerender(<AiAction loading />);
		const button = screen.getByRole("button");
		expect(button.textContent).toBe("Writing…");
		expect(spinners(button)).toHaveLength(1);
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.hasAttribute("disabled")).toBe(true);
		expect(button.className).toContain("data-loading:opacity-100");
		rerender(<AiAction filled loading />);
		expect(screen.getByRole("button").textContent).toBe("Writing…");
	});
});
