import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Box } from "../box";
import { Grid } from "../grid";
import { LAYOUT, type LayoutProps } from "../layout";
import { Inline, Stack } from "../stack";

/** Every value of every layout option, as the props a part receives. */
const CASES = Object.entries(LAYOUT).flatMap(([option, values]) =>
	Object.entries(values).map(([value, classes]) => ({
		option,
		value: value === "true" ? true : value === "false" ? false : /^\d+$/.test(value) ? Number(value) : value,
		classes: classes as string,
	})),
);
const PARTS = { Box, Stack, Inline, Grid } as const;

describe("layout options", () => {
	for (const [name, Part] of Object.entries(PARTS))
		it(`${name} turns every option into its classes and keeps none as an attribute`, () => {
			for (const { option, value, classes } of CASES) {
				const props = { [option]: value } as LayoutProps;
				const { unmount } = render(<Part data-testid="part" {...props} />);
				const el = screen.getByTestId("part");
				for (const cls of classes.split(" ")) expect(el.classList, `${option}=${String(value)}`).toContain(cls);
				expect(el.hasAttribute(option)).toBe(false);
				unmount();
			}
		});
});

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
