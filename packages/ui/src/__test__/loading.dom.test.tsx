import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../button";
import { TextButton } from "../text-button";

describe("a loading control", () => {
	it("UI-A1 is busy and cannot be pressed", () => {
		const { rerender } = render(<Button>Save</Button>);
		expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
		rerender(<Button loading>Save</Button>);
		expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
		expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
		rerender(<TextButton loading>Writing…</TextButton>);
		expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
		expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
	});
});
