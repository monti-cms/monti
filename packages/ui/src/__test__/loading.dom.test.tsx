import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiAction } from "../ai-action";
import { Button } from "../button";

describe("a loading control", () => {
	it("UI-A1 is busy and cannot be pressed", () => {
		const { rerender } = render(<Button>Save</Button>);
		expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
		rerender(<Button loading>Save</Button>);
		expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
		expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
		rerender(<AiAction loading />);
		expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
		expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
	});
});
