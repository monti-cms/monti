import { Search } from "@carbon/icons-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiAction } from "../ai-action";
import { Button } from "../button";

const spinners = (root: ParentNode = document) => root.querySelectorAll("[data-slot=spinner]");

describe("loading controls show a spinner", () => {
	it("a loading Button puts the spinner first, in place of its leading icon, and cannot be pressed; an idle one has none", () => {
		const { rerender } = render(
			<Button>
				<Search data-testid="icon" aria-hidden />
				Saving…
			</Button>,
		);
		expect(spinners()).toHaveLength(0);
		rerender(
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
		// The icon stays in the tree (the label's markup is the caller's); the spinner is what stands in front of the words.
		expect(screen.getByTestId("icon").previousElementSibling).toBe(button.firstElementChild);
	});

	it("a loading AiAction replaces its mark with the spinner and the working label", () => {
		const { rerender } = render(<AiAction />);
		expect(screen.getByRole("button").textContent).toBe("Fill");
		rerender(<AiAction loading />);
		const button = screen.getByRole("button");
		expect(button.textContent).toBe("Writing…");
		expect(spinners(button)).toHaveLength(1);
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.hasAttribute("disabled")).toBe(true);
		rerender(<AiAction filled loading />);
		expect(screen.getByRole("button").textContent).toBe("Writing…");
	});
});
