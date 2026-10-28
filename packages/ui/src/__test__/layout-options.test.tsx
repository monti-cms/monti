import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Box } from "../box";

describe("a scrolling box", () => {
	it("is the place of the screen-reader-only inputs inside it, and still lets `sticky` and `place` win", () => {
		for (const overflow of ["auto", "y", "x"] as const) {
			const { unmount } = render(<Box data-testid="part" overflow={overflow} />);
			expect(screen.getByTestId("part").classList).toContain("relative");
			unmount();
		}
		render(<Box data-testid="part" overflow="y" position="sticky" />);
		expect(screen.getByTestId("part").classList).toContain("sticky");
		expect(screen.getByTestId("part").classList).not.toContain("relative");
	});
});
