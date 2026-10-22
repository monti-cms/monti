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
		value: value === "true" ? true : value === "false" ? false : value === "0" ? 0 : value,
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
